import { createClient } from '@/lib/supabase/server';
import { embedText } from '@/lib/openai';
import { hybridSearch } from '@/lib/elasticsearch';
import { buildSystemPrompt } from '@/lib/prompts';
import { streamAnswer, type ChatTurn } from '@/lib/anthropic';

export const maxDuration = 60;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

  if (!chatbotId || !question) {
    return new Response('chatbotId et question sont requis.', { status: 400 });
  }

  // RLS scopes this to chatbots the caller's org owns.
  const { data: chatbot, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, organization_id, system_prompt_template')
    .eq('id', chatbotId)
    .single();

  if (chatbotError || !chatbot) {
    return new Response('Chatbot introuvable.', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const queryEmbedding = await embedText(question);

        const chunks = await hybridSearch({
          organizationId: chatbot.organization_id,
          chatbotId: chatbot.id,
          queryText: question,
          queryEmbedding,
          topK: 5,
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
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue.';
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
