import OpenAI from 'openai';
import { logWarn } from '@/lib/logger';

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

// ---------------------------------------------------------------------------
// Query rewriting (docs/roadmap.md item 2). One extra LLM call before
// retrieval that turns the raw user question into a query better suited to
// semantic (kNN) search and one better suited to keyword (BM25) search —
// e.g. a vague or multi-part question gets cleaned up / focused. Never
// blocks the pipeline: any failure falls back to the raw question for both.
// ---------------------------------------------------------------------------

export interface RewrittenQuery {
  semanticQuery: string;
  keywordQuery: string;
}

const QUERY_REWRITE_SYSTEM_PROMPT = `Tu reformules la question d'un utilisateur en deux versions optimisées pour la recherche documentaire dans une base de connaissances. Tu ne réponds jamais à la question, tu la reformules seulement.

- semanticQuery : une reformulation claire et complète de l'intention de la question, adaptée à une recherche par similarité sémantique. Si la question a plusieurs volets, résume l'ensemble en une phrase cohérente.
- keywordQuery : les termes clés et mots importants de la question (noms, termes techniques, références précises), adaptés à une recherche par mots-clés. Plus court que semanticQuery, pas une phrase complète.

Si la question est déjà claire et simple, renvoie une version très proche de l'originale.`;

/**
 * Rewrites a raw question into a semantic-search query and a keyword-search
 * query. Falls back to returning the original question for both if the
 * rewrite call fails or returns something unusable.
 */
export async function rewriteQuery(question: string): Promise<RewrittenQuery> {
  const fallback: RewrittenQuery = { semanticQuery: question, keywordQuery: question };

  try {
    const openai = getOpenAiClient();
    const response = await openai.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      max_completion_tokens: 300,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'query_rewrite',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              semanticQuery: { type: 'string' },
              keywordQuery: { type: 'string' },
            },
            required: ['semanticQuery', 'keywordQuery'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: QUERY_REWRITE_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Réponse vide');

    const parsed = JSON.parse(raw);
    if (!parsed.semanticQuery || !parsed.keywordQuery) {
      throw new Error('Champs manquants dans la sortie structurée');
    }

    return { semanticQuery: parsed.semanticQuery, keywordQuery: parsed.keywordQuery };
  } catch (err) {
    logWarn('query_rewrite.failed', {
      question,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}
