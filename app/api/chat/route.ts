import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { isUuid, parseFeedbackValue, setAssistantMessageFeedback } from '@/lib/feedback';
import { embedText, streamAnswer, rewriteQuery, rerankChunks } from '@/lib/openai';
import {
  createNotifyOwnerOfLeadTool,
  NOTIFY_OWNER_PROMPT_NOTE,
  createLeadQualificationTool,
  buildLeadQualificationPromptNote,
} from '@/lib/agenticTools';
import { hybridSearch } from '@/lib/elasticsearch';
import { buildSystemPrompt } from '@/lib/prompts';
import { logInfo, logWarn } from '@/lib/logger';
import { reportDbError, reportError } from '@/lib/reportError';
import { checkRateLimit } from '@/lib/rateLimit';
import { checkQuota } from '@/lib/usage';
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
    const { message } = reportError('chat.history_failed', err, { userId: user.id, chatbotId, conversationId });
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
    const { message } = reportDbError('chat.delete_failed', error, { userId: user.id, chatbotId, conversationId });
    return new Response(message, { status: 400 });
  }
  return Response.json({ ok: true });
}

// Rates one answer 👍/👎 (roadmap item 59). Ownership is checked through the
// caller's RLS client; the write itself goes through the admin client because
// `messages` has no update policy (members must not be able to edit content).
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Non authentifié.', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const chatbotId: unknown = body?.chatbotId;
  const conversationId: unknown = body?.conversationId;
  const messageId: unknown = body?.messageId;
  const value = parseFeedbackValue(body?.value);

  if (!isUuid(chatbotId) || !isUuid(conversationId) || !isUuid(messageId) || value === undefined) {
    return new Response('chatbotId, conversationId, messageId et value sont requis.', { status: 400 });
  }

  try {
    const owned = await getConversationForIdentity(supabase, conversationId, {
      chatbotId,
      userId: user.id,
    });
    if (!owned) return new Response('Conversation introuvable.', { status: 404 });

    const updated = await setAssistantMessageFeedback(getAdminClient(), { conversationId, messageId, value });
    if (!updated) return new Response('Message introuvable.', { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    const { message } = reportError('chat.feedback_failed', err, { userId: user.id, chatbotId, conversationId });
    return new Response(message, { status: 500 });
  }
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
    .select(
      'id, organization_id, system_prompt_template, use_documents, allow_email_tool, notification_email, allow_lead_qualification, lead_qualification_criteria, meeting_link, organizations!inner(plan, overage_mode)'
    )
    .eq('id', chatbotId)
    .single();

  if (chatbotError || !chatbot) {
    logWarn('chat.chatbot_not_found', { userId: user.id, chatbotId, error: chatbotError?.message });
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  const org = Array.isArray(chatbot.organizations) ? chatbot.organizations[0] : chatbot.organizations;
  const { blocked } = await checkQuota(supabase, {
    organizationId: chatbot.organization_id,
    plan: org.plan,
    overageMode: org.overage_mode,
  });
  if (blocked) {
    logWarn('chat.quota_blocked', { userId: user.id, chatbotId: chatbot.id });
    return new Response(
      'Quota de messages atteint pour ce mois. Passez à un palier supérieur ou activez le débit automatique dans Paramètres > Organisation.',
      { status: 402 }
    );
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

        // Prompt-only chatbots (docs/roadmap.md item 23) skip retrieval
        // entirely — no documents to search, and forcing the "answer only
        // from documents" instruction with zero chunks would make the model
        // refuse every question instead of using what's in the prompt.
        let chunks: Awaited<ReturnType<typeof hybridSearch>> = [];
        let isSmallTalk = false;
        if (chatbot.use_documents) {
          const rewritten = await rewriteQuery(question);
          const { semanticQuery, keywordQuery } = rewritten;
          isSmallTalk = rewritten.isSmallTalk;
          // Real progress for widgets that show steps instead of rotating
          // messages (docs/roadmap.md item 51).
          controller.enqueue(encoder.encode(sseEvent('status', { step: 'searching', topic: keywordQuery })));
          const queryEmbedding = await embedText(semanticQuery);

          chunks = await hybridSearch({
            organizationId: chatbot.organization_id,
            chatbotId: chatbot.id,
            queryText: keywordQuery,
            queryEmbedding,
          });
          chunks = await rerankChunks(question, chunks);
        }

        const sources = Array.from(
          new Map(chunks.map((c) => [c.document_id, c.document_filename])).values()
        );
        controller.enqueue(encoder.encode(sseEvent('sources', { sources })));

        const notifyEmail = chatbot.allow_email_tool ? chatbot.notification_email : null;
        const leadQualificationEmail = chatbot.allow_lead_qualification ? chatbot.notification_email : null;
        const combinedTools = [
          ...(notifyEmail ? [createNotifyOwnerOfLeadTool(notifyEmail, { ...logCtx, conversationId })] : []),
          ...(leadQualificationEmail
            ? [createLeadQualificationTool(leadQualificationEmail, { ...logCtx, conversationId })]
            : []),
        ];
        const tools = combinedTools.length ? combinedTools : undefined;

        const toolsNote = [
          notifyEmail ? NOTIFY_OWNER_PROMPT_NOTE : null,
          leadQualificationEmail
            ? buildLeadQualificationPromptNote(chatbot.lead_qualification_criteria, chatbot.meeting_link)
            : null,
        ]
          .filter(Boolean)
          .join('\n\n');

        const systemPrompt = buildSystemPrompt({
          systemPromptTemplate: chatbot.system_prompt_template,
          contextChunks: chunks,
          useDocuments: chatbot.use_documents,
          toolsNote: toolsNote || undefined,
        });

        controller.enqueue(encoder.encode(sseEvent('status', { step: 'writing' })));
        let answer = '';
        const gen = streamAnswer({ systemPrompt, history, question, tools });
        let step = await gen.next();
        while (!step.done) {
          answer += step.value;
          controller.enqueue(encoder.encode(sseEvent('token', { text: step.value })));
          step = await gen.next();
        }
        const { truncated } = step.value;

        const { assistantMessageId } = await appendTurn(supabase, conversationId, {
          question,
          answer,
          sources,
          noContext: chatbot.use_documents && chunks.length === 0 && !isSmallTalk,
        });

        if (truncated) {
          controller.enqueue(encoder.encode(sseEvent('truncated', {})));
          logWarn('chat.answer_truncated', logCtx);
        }
        controller.enqueue(encoder.encode(sseEvent('done', { messageId: assistantMessageId })));
        logInfo('chat.success', {
          ...logCtx,
          chunkCount: chunks.length,
          sourceCount: sources.length,
        });
      } catch (err) {
        // Never the raw exception text — see lib/userErrors.ts.
        const { message } = reportError('chat.failed', err, logCtx);
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
