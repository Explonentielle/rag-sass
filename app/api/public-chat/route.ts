import { getAdminClient } from '@/lib/supabase/admin';
import { embedText, streamAnswer, rewriteQuery, rerankChunks } from '@/lib/openai';
import { createNotifyOwnerOfLeadTool, NOTIFY_OWNER_PROMPT_NOTE } from '@/lib/agenticTools';
import { hybridSearch } from '@/lib/elasticsearch';
import { buildSystemPrompt } from '@/lib/prompts';
import { logInfo, logWarn, logError } from '@/lib/logger';
import { checkPublicChatRateLimit, getClientIp } from '@/lib/rateLimit';
import { checkQuota } from '@/lib/usage';
import { getAccessibleChatbot, isValidVisitorId } from '@/lib/publicChatAccess';
import { loadConversationAttachments, removeConversationFiles } from '@/lib/conversationFiles';
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

// Public, unauthenticated chat endpoint for the floating widget and iframe
// embeds. No login required by design (that's the point of an embeddable
// widget) — access control is: knowing the chatbotId, the chatbot's
// `is_public` flag, and (if the owner configured any) `allowed_origins`
// (see getAccessibleChatbot below and docs/integration.md). Rate-limited
// per chatbot+visitor, with auto-blacklist of IPs that exhaust the window
// twice in a row (see lib/rateLimit.ts).
//
// Conversation history is keyed by a client-generated visitorId (UUID kept
// in the widget's localStorage, see components/ChatWidget.tsx) instead of
// a user_id — there's no Supabase session for an anonymous visitor. This is
// a persistence key, not an auth credential: anyone holding that UUID can
// read that visitor's chat history for this chatbot, same trust model as
// most anonymous embeddable widgets (e.g. Intercom).

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// With no conversationId: lists this visitor's saved conversations for the
// switcher. With one: replays its messages, after verifying ownership.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const chatbotId = url.searchParams.get('chatbotId');
  const visitorId = url.searchParams.get('visitorId');
  const conversationId = url.searchParams.get('conversationId');

  if (!chatbotId || !isValidVisitorId(visitorId)) {
    return new Response('chatbotId et visitorId sont requis.', { status: 400 });
  }

  const admin = getAdminClient();
  const access = await getAccessibleChatbot(admin, chatbotId, request);
  if (!access.ok) {
    logWarn('public-chat.get_blocked', { chatbotId, reason: access.reason });
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  try {
    if (!conversationId) {
      const conversations = await listConversations(admin, { chatbotId, visitorId });
      return Response.json({ conversations });
    }

    const owned = await getConversationForIdentity(admin, conversationId, { chatbotId, visitorId });
    if (!owned) {
      return new Response('Conversation introuvable.', { status: 404 });
    }
    const history = await loadHistory(admin, conversationId);
    return Response.json({ messages: history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('public-chat.history_failed', { chatbotId, conversationId, error: message });
    return new Response(message, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const chatbotId = url.searchParams.get('chatbotId');
  const visitorId = url.searchParams.get('visitorId');
  const conversationId = url.searchParams.get('conversationId');

  if (!chatbotId || !isValidVisitorId(visitorId) || !conversationId) {
    return new Response('chatbotId, visitorId et conversationId sont requis.', { status: 400 });
  }

  const admin = getAdminClient();
  const access = await getAccessibleChatbot(admin, chatbotId, request);
  if (!access.ok) {
    logWarn('public-chat.delete_blocked', { chatbotId, reason: access.reason });
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  // Ownership first: removing the stored files below must only happen for
  // the visitor's own conversation, not for any (chatbotId, conversationId)
  // pair a caller can guess.
  const owned = await getConversationForIdentity(admin, conversationId, { chatbotId, visitorId });
  if (!owned) {
    return new Response('Conversation introuvable.', { status: 404 });
  }
  await removeConversationFiles(admin, { conversationId });

  const { error } = await admin
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('chatbot_id', chatbotId)
    .eq('visitor_id', visitorId);

  if (error) {
    return new Response(error.message, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chatbotId: string | undefined = body?.chatbotId;
  const question: string | undefined = body?.question?.trim();
  const visitorId: unknown = body?.visitorId;
  const requestedConversationId: string | undefined = body?.conversationId;

  if (!chatbotId || !question || !isValidVisitorId(visitorId)) {
    return new Response('chatbotId, question et visitorId sont requis.', { status: 400 });
  }

  const ip = getClientIp(request);
  const rateLimit = checkPublicChatRateLimit(chatbotId, ip);
  if (!rateLimit.allowed) {
    if (rateLimit.blacklisted) {
      logWarn('public-chat.blacklisted_ip_blocked', { chatbotId, ip });
      return new Response('Accès bloqué.', { status: 403 });
    }
    logWarn('public-chat.rate_limited', { chatbotId, ip });
    return new Response('Trop de requêtes, réessayez dans un instant.', {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { 'Retry-After': String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  const admin = getAdminClient();
  const access = await getAccessibleChatbot(admin, chatbotId, request);
  if (!access.ok) {
    logWarn('public-chat.post_blocked', { chatbotId, reason: access.reason });
    return new Response('Chatbot introuvable.', { status: 404 });
  }
  const { chatbot } = access;

  const { blocked } = await checkQuota(admin, {
    organizationId: chatbot.organization_id,
    plan: chatbot.plan,
    overageMode: chatbot.overage_mode,
  });
  if (blocked) {
    logWarn('public-chat.quota_blocked', { chatbotId: chatbot.id });
    return new Response(
      "Ce chatbot a atteint son quota de messages pour ce mois. Merci de réessayer plus tard.",
      { status: 402 }
    );
  }

  if (requestedConversationId) {
    const owned = await getConversationForIdentity(admin, requestedConversationId, {
      chatbotId: chatbot.id,
      visitorId,
    });
    if (!owned) {
      return new Response('Conversation introuvable.', { status: 404 });
    }
  }

  const logCtx = { chatbotId: chatbot.id, organizationId: chatbot.organization_id, public: true };
  // Length, not content — see the GDPR note in lib/logger.ts.
  logInfo('public-chat.request', { ...logCtx, questionLength: question.length });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const conversationId =
          requestedConversationId ??
          (await createConversation(admin, { chatbotId: chatbot.id, visitorId }));
        controller.enqueue(encoder.encode(sseEvent('conversation', { conversationId })));

        const history = requestedConversationId
          ? toChatTurns(await loadHistory(admin, conversationId))
          : [];

        // Prompt-only chatbots (docs/roadmap.md item 23) skip retrieval
        // entirely — see the matching comment in app/api/chat/route.ts.
        let chunks: Awaited<ReturnType<typeof hybridSearch>> = [];
        if (chatbot.use_documents) {
          const { semanticQuery, keywordQuery } = await rewriteQuery(question);
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
        const tools = notifyEmail
          ? [
              createNotifyOwnerOfLeadTool(
                notifyEmail,
                { ...logCtx, conversationId },
                chatbot.allow_visitor_uploads
                  ? () => loadConversationAttachments(admin, conversationId)
                  : undefined
              ),
            ]
          : undefined;

        const systemPrompt = buildSystemPrompt({
          systemPromptTemplate: chatbot.system_prompt_template,
          contextChunks: chunks,
          useDocuments: chatbot.use_documents,
          toolsNote: notifyEmail ? NOTIFY_OWNER_PROMPT_NOTE : undefined,
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

        await appendTurn(admin, conversationId, { question, answer, sources });

        if (truncated) {
          controller.enqueue(encoder.encode(sseEvent('truncated', {})));
          logWarn('public-chat.answer_truncated', logCtx);
        }
        controller.enqueue(encoder.encode(sseEvent('done', {})));
        logInfo('public-chat.success', {
          ...logCtx,
          chunkCount: chunks.length,
          sourceCount: sources.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue.';
        logError('public-chat.failed', { ...logCtx, error: message, stack: err instanceof Error ? err.stack : undefined });
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
