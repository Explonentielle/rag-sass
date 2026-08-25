import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams a RAG answer from Claude. `history` should NOT include the
 * current question: that's passed separately as `question` and appended
 * as the final user turn.
 */
export async function* streamAnswer(params: {
  systemPrompt: string;
  history: ChatTurn[];
  question: string;
  model?: string;
}): AsyncGenerator<string> {
  const { systemPrompt, history, question, model } = params;
  const anthropic = getAnthropicClient();

  const stream = anthropic.messages.stream({
    model: model || DEFAULT_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [...history, { role: 'user', content: question }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
