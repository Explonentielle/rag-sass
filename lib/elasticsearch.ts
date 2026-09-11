import { Client } from '@elastic/elasticsearch';

const EMBEDDING_DIMS = 1536;

// CHUNKS_INDEX is an ALIAS, not a raw index name — every query/index/delete
// call in this file targets it exactly like a plain index name (ES treats
// the two interchangeably for search/index/delete), but an alias can be
// repointed to a new physical index later without touching a single line
// of app code. That's what a mapping/analyzer change needs: ES never lets
// you alter the analyzer of an already-mapped field on a live index — the
// only way is to create a new index with the new mapping and reindex into
// it (see docs/roadmap.md item 39 and scripts/migrate-french-analyzer.mts,
// the one-time script that did this the first time, going from a plain
// `documents_chunks` index to this alias scheme).
export const CHUNKS_INDEX = process.env.ELASTICSEARCH_INDEX || 'documents_chunks';

/** Physical index name behind the CHUNKS_INDEX alias, versioned so a future
 * mapping change has somewhere new to reindex into. */
export function chunksPhysicalIndexName(version: number): string {
  return `${CHUNKS_INDEX}-${String(version).padStart(6, '0')}`;
}

// French analysis for the `content` field (docs/roadmap.md item 39): the
// default "standard" analyzer does plain tokenizing + lowercasing only —
// no stemming, so "vacances" and "vacance" are unrelated tokens to BM25,
// even though they mean the same thing. Recipe is ES's own documented
// French analyzer, just declared explicitly (rather than the opaque
// built-in `"french"` analyzer name) so the behavior is visible here
// instead of hidden behind a magic string:
// - french_elision: folds "d'hiver" -> "hiver", "l'école" -> "école", etc.
// - french_stop: removes common French stopwords ("le", "de", "et"...).
// - french_stemmer (light_french): folds singular/plural and common
//   inflections ("vacances"/"vacance" both stem to the same token) — the
//   "light" variant is less aggressive than the full Snowball stemmer,
//   which over-stems and merges unrelated words together.
const CHUNKS_ANALYSIS_SETTINGS = {
  analysis: {
    filter: {
      french_elision: {
        type: 'elision' as const,
        articles_case: true,
        articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu'],
      },
      french_stop: { type: 'stop' as const, stopwords: '_french_' as const },
      french_stemmer: { type: 'stemmer' as const, language: 'light_french' },
    },
    analyzer: {
      french_content: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['french_elision', 'lowercase', 'french_stop', 'french_stemmer'],
      },
    },
  },
};

export const CHUNKS_MAPPING_PROPERTIES = {
  content: { type: 'text' as const, analyzer: 'french_content' },
  embedding: {
    type: 'dense_vector' as const,
    dims: EMBEDDING_DIMS,
    index: true,
    similarity: 'cosine' as const,
  },
  organization_id: { type: 'keyword' as const },
  chatbot_id: { type: 'keyword' as const },
  document_id: { type: 'keyword' as const },
  document_filename: { type: 'keyword' as const },
  chunk_index: { type: 'integer' as const },
};

let client: Client | null = null;

/**
 * Elasticsearch client, configured entirely from env vars so the same code
 * works against the local docker-compose node (no auth) and a hosted
 * cluster (username/password or API key) without code changes.
 */
export function getEsClient(): Client {
  if (client) return client;

  const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;

  client = new Client({
    node,
    ...(apiKey
      ? { auth: { apiKey } }
      : username && password
        ? { auth: { username, password } }
        : {}),
  });

  return client;
}

export interface ChunkDoc {
  content: string;
  embedding: number[];
  organization_id: string;
  chatbot_id: string;
  document_id: string;
  document_filename: string;
  chunk_index: number;
}

/**
 * Creates the CHUNKS_INDEX alias (pointing at a fresh physical index) if it
 * doesn't exist yet. Safe to call on every server start: a no-op once the
 * alias is present. Only handles a from-scratch environment — migrating an
 * already-existing plain index (no alias) to this scheme is a one-time,
 * manual step, see scripts/migrate-french-analyzer.mts.
 */
export async function ensureChunksIndex(): Promise<void> {
  const es = getEsClient();
  const aliasExists = await es.indices.existsAlias({ name: CHUNKS_INDEX });
  if (aliasExists) return;

  await es.indices.create({
    index: chunksPhysicalIndexName(1),
    settings: CHUNKS_ANALYSIS_SETTINGS,
    mappings: { properties: CHUNKS_MAPPING_PROPERTIES },
    aliases: { [CHUNKS_INDEX]: {} },
  });
}

/** Deletes all chunks belonging to a document (used on re-upload or delete). */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const es = getEsClient();
  await es.deleteByQuery({
    index: CHUNKS_INDEX,
    query: { term: { document_id: documentId } },
    refresh: true,
  });
}

/** Deletes every chunk belonging to an organization in one query — used
 * when deleting an org, instead of looping `deleteDocumentChunks` per
 * document. */
export async function deleteOrganizationChunks(organizationId: string): Promise<void> {
  const es = getEsClient();
  await es.deleteByQuery({
    index: CHUNKS_INDEX,
    query: { term: { organization_id: organizationId } },
    refresh: true,
  });
}

export interface RetrievedChunk {
  content: string;
  document_id: string;
  document_filename: string;
  chunk_index: number;
  score: number;
}

const RRF_RANK_CONSTANT = 60;

// Retrieval sizing: instead of always returning a fixed number of chunks
// (previously a hard-coded topK: 5), we fetch a generous candidate pool,
// fuse it via RRF, then keep however many chunks stay competitive with the
// best match — a narrow question with one clearly-best chunk returns few
// results, a broad question with several similarly-strong matches returns
// more, up to MAX_CHUNKS. See docs/roadmap.md item 1.
const CANDIDATE_POOL_SIZE = 15; // also doubles as the hard cap on returned chunks
const MIN_SCORE_RATIO = 0.6; // keep chunks scoring >= 60% of the top chunk's fused score

/**
 * Hybrid retrieval: full-text (BM25) on `content` fused with kNN on
 * `embedding`, filtered to one chatbot's organization scope. Always filter
 * by both organization_id and chatbot_id: this is the multi-tenant
 * boundary.
 *
 * Fusion is Reciprocal Rank Fusion computed in application code (two
 * separate searches, combined by rank) rather than Elasticsearch's native
 * `retriever.rrf`, which requires a Platinum license and isn't something we
 * want to depend on for a self-hosted Basic-license cluster. Same formula
 * ES uses natively: score(doc) = sum over retrievers of 1 / (k + rank),
 * with k = 60 (ES's own default).
 */
export async function hybridSearch(params: {
  organizationId: string;
  chatbotId: string;
  queryText: string;
  queryEmbedding: number[];
  maxChunks?: number;
  minScoreRatio?: number;
}): Promise<RetrievedChunk[]> {
  const {
    organizationId,
    chatbotId,
    queryText,
    queryEmbedding,
    maxChunks = CANDIDATE_POOL_SIZE,
    minScoreRatio = MIN_SCORE_RATIO,
  } = params;
  const es = getEsClient();

  const filter = [
    { term: { organization_id: organizationId } },
    { term: { chatbot_id: chatbotId } },
  ];

  const rankWindowSize = Math.max(CANDIDATE_POOL_SIZE, maxChunks);

  const [textResult, knnResult] = await Promise.all([
    es.search({
      index: CHUNKS_INDEX,
      size: rankWindowSize,
      query: {
        bool: {
          must: [{ match: { content: queryText } }],
          filter,
        },
      },
      _source: ['content', 'document_id', 'document_filename', 'chunk_index'],
    }),
    es.search({
      index: CHUNKS_INDEX,
      size: rankWindowSize,
      knn: {
        field: 'embedding',
        query_vector: queryEmbedding,
        k: rankWindowSize,
        num_candidates: Math.max(50, rankWindowSize * 5),
        filter,
      },
      _source: ['content', 'document_id', 'document_filename', 'chunk_index'],
    }),
  ]);

  const fused = new Map<string, { source: any; score: number }>();

  const addRankedHits = (hits: any[]) => {
    hits.forEach((hit, i) => {
      const rank = i + 1;
      const contribution = 1 / (RRF_RANK_CONSTANT + rank);
      const existing = fused.get(hit._id);
      if (existing) {
        existing.score += contribution;
      } else {
        fused.set(hit._id, { source: hit._source, score: contribution });
      }
    });
  };

  addRankedHits(textResult.hits.hits);
  addRankedHits(knnResult.hits.hits);

  const ranked = Array.from(fused.values()).sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;
  const scoreFloor = topScore * minScoreRatio;

  return ranked
    .filter((r) => r.score >= scoreFloor)
    .slice(0, maxChunks)
    .map(({ source, score }) => ({
      content: source.content,
      document_id: source.document_id,
      document_filename: source.document_filename,
      chunk_index: source.chunk_index,
      score,
    }));
}
