// Currently unused: chat generation runs on OpenAI (lib/openai.ts) to keep
// billing on a single provider. Kept in place — and kept in sync feature-
// for-feature with lib/openai.ts — in case that decision flips back.
import Anthropic from '@anthropic-ai/sdk';
// zod 3.25+ ships a forward-compat v4 API at this subpath — needed because
// @anthropic-ai/sdk's zodOutputFormat helper (below) is typed against zod
// v4's internals ($ZodTypeInternals); the classic `from 'zod'` import on a
// 3.x install is still the old v3 shape and doesn't satisfy it.
import { z } from 'zod/v4';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { logWarn } from '@/lib/logger';

let client: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// No date suffix: current model IDs are used as-is (see docs/roadmap.md /
// claude-api skill). Haiku 4.5, not Opus, because this is the explicit
// default this project was originally specced with (fast + cheap for
// short, tightly-grounded RAG answers); switch to claude-sonnet-5 via
// ANTHROPIC_MODEL for higher quality if this is ever re-enabled.
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

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

// ---------------------------------------------------------------------------
// Query rewriting (docs/roadmap.md item 2) — Claude equivalent of
// lib/openai.ts's rewriteQuery(). Same contract: never blocks the pipeline,
// falls back to the raw question for both fields on any failure.
// ---------------------------------------------------------------------------

export interface RewrittenQuery {
  semanticQuery: string;
  keywordQuery: string;
}

const QueryRewriteSchema = z.object({
  semanticQuery: z.string(),
  keywordQuery: z.string(),
});

const QUERY_REWRITE_SYSTEM_PROMPT = `Tu reformules la question d'un utilisateur en deux versions optimisées pour la recherche documentaire dans une base de connaissances. Tu ne réponds jamais à la question, tu la reformules seulement.

- semanticQuery : une reformulation claire et complète de l'intention de la question, adaptée à une recherche par similarité sémantique. Si la question a plusieurs volets, résume l'ensemble en une phrase cohérente.
- keywordQuery : les termes clés et mots importants de la question (noms, termes techniques, références précises), adaptés à une recherche par mots-clés. Plus court que semanticQuery, pas une phrase complète.

Si la question est déjà claire et simple, renvoie une version très proche de l'originale.`;

export async function rewriteQuery(question: string): Promise<RewrittenQuery> {
  const fallback: RewrittenQuery = { semanticQuery: question, keywordQuery: question };

  try {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.parse({
      model: DEFAULT_MODEL,
      max_tokens: 300,
      system: QUERY_REWRITE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: question }],
      output_config: {
        format: zodOutputFormat(QueryRewriteSchema),
      },
    });

    if (!response.parsed_output) {
      throw new Error('Sortie structurée vide ou invalide');
    }

    return response.parsed_output;
  } catch (err) {
    logWarn('query_rewrite.failed', {
      questionLength: question.length,
      provider: 'anthropic',
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}
