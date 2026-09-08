import { createClient } from '@/lib/supabase/server';
import { embedText, streamAnswer, rewriteQuery } from '@/lib/openai';
import { hybridSearch } from '@/lib/elasticsearch';
import { buildSystemPrompt } from '@/lib/prompts';
import { logInfo, logWarn, logError } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  createConversation,
  listConversations,
  getConversationForIdentity,
  loadHistory,
  toChatTurns,
  appendTurn,
} from '@/lib/conversations';

// No cap on answer length (see lib/openai.ts) means a genuinely long answer
// can take a while to stream — give it more room than a typical short reply
// would need, so the platform doesn't kill the invocation mid-stream.
export const maxDuration = 120;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// With no conversationId: lists this chatbot's saved conversations for the
// caller (for the conversation switcher). With one: replays its messages,
// after verifying it actually belongs to the caller.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const chatbotId = params.get('chatbotId');
  const conversationId = params.get('conversationId');
  if (!chatbotId) {
    return new Response('chatbotId est requis.', { status: 400 });
  }

  try {
    if (!conversationId) {
      const conversations = await listConversations(supabase, { chatbotId, userId: user.id });
      return Response.json({ conversations });
    }

    const owned = await getConversationForIdentity(supabase, conversationId, {
      chatbotId,
      userId: user.id,
    });
    if (!owned) {
      return new Response('Conversation introuvable.', { status: 404 });
    }
    const history = await loadHistory(supabase, conversationId);
    return Response.json({ messages: history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('chat.history_failed', { userId: user.id, chatbotId, conversationId, error: message });
    return new Response(message, { status: 500 });
  }
}

// Deletes one conversation (e.g. from a "supprimer" action in the switcher).
export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const chatbotId = params.get('chatbotId');
  const conversationId = params.get('conversationId');
  if (!chatbotId || !conversationId) {
    return new Response('chatbotId et conversationId sont requis.', { status: 400 });
  }

  // RLS (conversations_delete) enforces org ownership; scoping to
  // user_id = caller here on top of that ensures deleting your own
  // conversation can't touch a teammate's for the same chatbot.
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('chatbot_id', chatbotId)
    .eq('user_id', user.id);

  if (error) {
    return new Response(error.message, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const chatbotId: string | undefined = body?.chatbotId;
  const question: string | undefined = body?.question?.trim();
  const requestedConversationId: string | undefined = body?.conversationId;

  if (!chatbotId || !question) {
    return new Response('chatbotId et question sont requis.', { status: 400 });
  }

  // Defense in depth — the public endpoint is the real abuse vector (see
  // app/api/public-chat/route.ts), but a sane per-user cap here costs
  // nothing and guards against a runaway client loop.
  const rateLimit = checkRateLimit(`chat:${user.id}`);
  if (!rateLimit.allowed) {
    logWarn('chat.rate_limited', { userId: user.id, chatbotId });
    return new Response('Trop de requêtes, réessayez dans un instant.', {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { 'Retry-After': String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  // RLS scopes this to chatbots the caller's org owns.
  const { data: chatbot, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, organization_id, system_prompt_template')
    .eq('id', chatbotId)
    .single();

  if (chatbotError || !chatbot) {
    logWarn('chat.chatbot_not_found', { userId: user.id, chatbotId, error: chatbotError?.message });
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  if (requestedConversationId) {
    const owned = await getConversationForIdentity(supabase, requestedConversationId, {
      chatbotId: chatbot.id,
      userId: user.id,
    });
    if (!owned) {
      return new Response('Conversation introuvable.', { status: 404 });
    }
  }

  const logCtx = { chatbotId: chatbot.id, organizationId: chatbot.organization_id, userId: user.id };
  // Length, not content — see the GDPR note in lib/logger.ts.
  logInfo('chat.request', { ...logCtx, questionLength: question.length });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const conversationId =
          requestedConversationId ??
          (await createConversation(supabase, { chatbotId: chatbot.id, userId: user.id }));
        // Tell the client which conversation this reply belongs to — it
        // needs this to keep sending follow-ups to the same thread,
        // especially the first message of a brand new one.
        controller.enqueue(encoder.encode(sseEvent('conversation', { conversationId })));

        const history = requestedConversationId
          ? toChatTurns(await loadHistory(supabase, conversationId))
          : [];

        const { semanticQuery, keywordQuery } = await rewriteQuery(question);
        const queryEmbedding = await embedText(semanticQuery);

        const chunks = await hybridSearch({
          organizationId: chatbot.organization_id,
          chatbotId: chatbot.id,
          queryText: keywordQuery,
          queryEmbedding,
        });

        const sources = Array.from(
          new Map(chunks.map((c) => [c.document_id, c.document_filename])).values()
        );
        controller.enqueue(encoder.encode(sseEvent('sources', { sources })));

        const systemPrompt = buildSystemPrompt({
          systemPromptTemplate: chatbot.system_prompt_template,
          contextChunks: chunks,
        });

        let answer = '';
        const gen = streamAnswer({ systemPrompt, history, question });
        let step = await gen.next();
        while (!step.done) {
          answer += step.value;
          controller.enqueue(encoder.encode(sseEvent('token', { text: step.value })));
          step = await gen.next();
        }
        const { truncated } = step.value;

        await appendTurn(supabase, conversationId, { question, answer, sources });

        if (truncated) {
          controller.enqueue(encoder.encode(sseEvent('truncated', {})));
          logWarn('chat.answer_truncated', logCtx);
        }
        controller.enqueue(encoder.encode(sseEvent('done', {})));
        logInfo('chat.success', {
          ...logCtx,
          chunkCount: chunks.length,
          sourceCount: sources.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue.';
        logError('chat.failed', { ...logCtx, error: message, stack: err instanceof Error ? err.stack : undefined });
        controller.enqueue(encoder.encode(sseEvent('error', { message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
