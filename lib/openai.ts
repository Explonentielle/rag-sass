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
 * as the final user turn. No max_completion_tokens is set: the answer runs
 * until the model naturally stops, however long that takes (a detailed
 * technical answer can legitimately run long) — the model's own absolute
 * output ceiling is the only limit left. The generator's return value
 * (available via manual `.next()` iteration, not a `for await...of` loop)
 * reports whether that ceiling was hit anyway, as a safety net.
 */
export async function* streamAnswer(params: {
  systemPrompt: string;
  history: ChatTurn[];
  question: string;
  model?: string;
}): AsyncGenerator<string, { truncated: boolean }, void> {
  const { systemPrompt, history, question, model } = params;
  const openai = getOpenAiClient();

  const stream = await openai.chat.completions.create({
    model: model || DEFAULT_CHAT_MODEL,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
      { role: 'user', content: question },
    ],
  });

  let finishReason: string | null = null;
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
    if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
  }

  return { truncated: finishReason === 'length' };
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
      questionLength: question.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Reranking (docs/roadmap.md item 4). RRF fusion (BM25 + kNN) ranks purely
// by retrieval signal, which can surface chunks that are topically close
// but don't actually answer the question. One extra LLM call after
// retrieval, judging each candidate chunk's real relevance to the raw
// question, structured output, same pattern as rewriteQuery above. First
// version deliberately reuses the already-connected chat LLM instead of a
// dedicated reranking service/cross-encoder (see roadmap for why). Never
// blocks the pipeline: any failure falls back to the pre-rerank order,
// capped to RERANK_MAX_CHUNKS.
// ---------------------------------------------------------------------------

const RERANK_MAX_CHUNKS = 5;

const RERANK_SYSTEM_PROMPT = `Tu évalues la pertinence d'extraits de documents par rapport à une question, dans le cadre d'un système de question-réponse : les extraits que tu juges pertinents seront transmis tels quels à un autre modèle pour rédiger la réponse finale. Ne garde que ceux qui apportent une information réellement utilisable pour répondre — même partiellement.

On te donne une question et une liste numérotée d'extraits (numérotation à partir de 0). Renvoie les index des extraits pertinents, du plus utile au moins utile pour répondre à la question :
- Si la question comporte plusieurs volets, garde les extraits utiles à chaque volet, pas seulement au premier.
- Un extrait qui répond partiellement, ou qui apporte un contexte nécessaire sans répondre entièrement, compte comme pertinent — la pertinence n'exige pas une réponse complète et autonome.
- Exclus uniquement les extraits réellement hors sujet, qui n'apportent aucune information utilisable pour cette question précise.
- En cas de doute entre garder et exclure un extrait, garde-le : un extrait de trop est sans conséquence, une information manquante empêche de répondre correctement.
- Renvoie une liste vide seulement si AUCUN extrait n'apporte quoi que ce soit d'utile.
- Ne renvoie jamais un index qui n'existe pas dans la liste fournie.`;

export interface RerankableChunk {
  content: string;
  document_filename: string;
}

/**
 * Reorders (and can drop) retrieval candidates by actual relevance to the
 * raw question, judged by the chat LLM via structured output. Falls back to
 * the pre-rerank order, capped to RERANK_MAX_CHUNKS, if the call fails or
 * returns something unusable — reranking is a quality refinement on top of
 * retrieval, not something the pipeline should ever be blocked by.
 */
export async function rerankChunks<T extends RerankableChunk>(
  question: string,
  chunks: T[]
): Promise<T[]> {
  if (chunks.length === 0) return chunks;

  const fallback = chunks.slice(0, RERANK_MAX_CHUNKS);

  try {
    const openai = getOpenAiClient();
    const numbered = chunks
      .map((c, i) => `[${i}] (${c.document_filename})\n${c.content}`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      max_completion_tokens: 300,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chunk_rerank',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              relevantIndices: { type: 'array', items: { type: 'integer' } },
            },
            required: ['relevantIndices'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: RERANK_SYSTEM_PROMPT },
        { role: 'user', content: `Question : ${question}\n\nExtraits :\n\n${numbered}` },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Réponse vide');

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.relevantIndices)) {
      throw new Error('Champ relevantIndices manquant ou invalide');
    }

    const seen = new Set<number>();
    const reranked: T[] = [];
    for (const index of parsed.relevantIndices) {
      if (
        typeof index === 'number' &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < chunks.length &&
        !seen.has(index)
      ) {
        seen.add(index);
        reranked.push(chunks[index]);
        if (reranked.length >= RERANK_MAX_CHUNKS) break;
      }
    }

    return reranked;
  } catch (err) {
    logWarn('rerank.failed', {
      questionLength: question.length,
      chunkCount: chunks.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// AI-assisted indexing (docs/roadmap.md item 18, section 0 — premium,
// gated by chatbots.use_ai_indexing + the org's plan). Replaces the
// mechanical chunker (lib/chunking.ts) with an LLM pass that cleans noise
// (repeated headers/footers, nav boilerplate from scraped content) and
// segments text along logical boundaries (a FAQ or table stays in one
// chunk) instead of blind character-count splitting. Scope deliberately
// limited to this: URL ingestion and a "review before indexing" mode are
// both called out in the roadmap as separate pieces of work, not included
// here.
// ---------------------------------------------------------------------------

// Roughly the batch size the roadmap's own cost estimate assumes — large
// enough to keep logical sections together, small enough to stay well
// within the model's context window even for a long document split into
// several batches.
const AI_INDEXING_BATCH_CHARS = 50_000;

const AI_INDEXING_SYSTEM_PROMPT = `Tu nettoies et segmentes un texte brut extrait d'un document (PDF, page web...) pour l'indexer dans une base de connaissances.

- Retire le bruit qui n'apporte aucune information (en-têtes/pieds de page répétés, numéros de page, menus de navigation, mentions publicitaires).
- Découpe le texte en segments qui respectent les frontières logiques du contenu : une question/réponse de FAQ reste dans un seul segment, un tableau reste intact, une section cohérente n'est jamais coupée en plein milieu.
- Ne résume jamais et ne reformule jamais le contenu : conserve le texte original tel quel, tu ne fais que le nettoyer et le découper.
- Si le texte ne contient rien d'exploitable (page vide, uniquement du bruit), renvoie une liste vide.`;

function splitIntoCharBatches(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const batches: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    batches.push(text.slice(i, i + maxChars));
  }
  return batches;
}

async function structureOneBatch(text: string): Promise<string[] | null> {
  try {
    const openai = getOpenAiClient();
    const response = await openai.chat.completions.create({
      model: DEFAULT_CHAT_MODEL,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ai_indexing',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              chunks: { type: 'array', items: { type: 'string' } },
            },
            required: ['chunks'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: AI_INDEXING_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Réponse vide');

    // A response cut off mid-generation (hit the model's own output
    // ceiling on a long batch) produces truncated, unparseable JSON —
    // JSON.parse throwing here is exactly how that case gets caught and
    // turned into a fallback below, no separate truncation check needed.
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.chunks) || !parsed.chunks.every((c: unknown) => typeof c === 'string')) {
      throw new Error('Champ chunks manquant ou invalide');
    }

    return parsed.chunks.filter((c: string) => c.trim().length > 0);
  } catch (err) {
    logWarn('ai_indexing.batch_failed', {
      textLength: text.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Structures raw extracted text into chunks via an LLM pass instead of
 * the mechanical chunker. Returns null on any failure (API error,
 * unusable structured output, a long document split into batches where
 * even one batch fails) so the caller (lib/ingest.ts) falls back to
 * chunkText — this is a quality upgrade on top of the pipeline, never a
 * hard dependency ingestion can be blocked by.
 */
export async function structureChunksWithAI(rawText: string): Promise<string[] | null> {
  const batches = splitIntoCharBatches(rawText, AI_INDEXING_BATCH_CHARS);
  const allChunks: string[] = [];

  for (const batch of batches) {
    const chunks = await structureOneBatch(batch);
    if (chunks === null) return null;
    allChunks.push(...chunks);
  }

  return allChunks.length > 0 ? allChunks : null;
}
