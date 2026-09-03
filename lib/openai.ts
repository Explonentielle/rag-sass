import OpenAI from 'openai';

let client: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

/** Embeds a batch of texts in one API call (OpenAI supports array input). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getOpenAiClient();
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

// ---------------------------------------------------------------------------
// Chat generation. Org has chosen to bill everything through OpenAI only —
// see lib/anthropic.ts for the (currently unused, kept for a possible
// future switch back) Claude equivalent.
// ---------------------------------------------------------------------------

// gpt-5.6-luna: OpenAI's cheapest current tier, well suited to a small,
// tightly-grounded RAG answering task (short context, short answers).
export const DEFAULT_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5.6-luna';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams a RAG answer from OpenAI. `history` should NOT include the
 * current question — that's passed separately as `question` and appended
 * as the final user turn.
 */
export async function* streamAnswer(params: {
  systemPrompt: string;
  history: ChatTurn[];
  question: string;
  model?: string;
}): AsyncGenerator<string> {
  const { systemPrompt, history, question, model } = params;
  const openai = getOpenAiClient();

  const stream = await openai.chat.completions.create({
    model: model || DEFAULT_CHAT_MODEL,
    max_completion_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
      { role: 'user', content: question },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
