import { getAdminClient } from '@/lib/supabase/admin';
import { embedText, streamAnswer, rewriteQuery, type ChatTurn } from '@/lib/openai';
import { hybridSearch } from '@/lib/elasticsearch';
import { buildSystemPrompt } from '@/lib/prompts';
import { logInfo, logWarn, logError } from '@/lib/logger';

export const maxDuration = 60;

// Public, unauthenticated chat endpoint for the floating widget and iframe
// embeds. No login required by design (that's the point of an embeddable
// widget) — the only access control is knowing the chatbotId. There is
// currently no per-chatbot allowlist of embedding domains and no rate
// limiting; see docs/integration.md for the current limitations.

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const chatbotId: string | undefined = body?.chatbotId;
  const question: string | undefined = body?.question?.trim();
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

  if (!chatbotId || !question) {
    return new Response('chatbotId et question sont requis.', { status: 400 });
  }

  const admin = getAdminClient();
  const { data: chatbot, error: chatbotError } = await admin
    .from('chatbots')
    .select('id, organization_id, system_prompt_template')
    .eq('id', chatbotId)
    .single();

  if (chatbotError || !chatbot) {
    logWarn('public-chat.chatbot_not_found', { chatbotId, error: chatbotError?.message });
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  const logCtx = { chatbotId: chatbot.id, organizationId: chatbot.organization_id, public: true };
  logInfo('public-chat.request', { ...logCtx, question });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
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

        for await (const token of streamAnswer({ systemPrompt, history, question })) {
          controller.enqueue(encoder.encode(sseEvent('token', { text: token })));
        }

        controller.enqueue(encoder.encode(sseEvent('done', {})));
        logInfo('public-chat.success', {
          ...logCtx,
          chunkCount: chunks.length,
          sourceCount: sources.length,
          semanticQuery,
          keywordQuery,
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
