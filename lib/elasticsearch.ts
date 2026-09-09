import { Client } from '@elastic/elasticsearch';

const EMBEDDING_DIMS = 1536;

export const CHUNKS_INDEX = process.env.ELASTICSEARCH_INDEX || 'documents_chunks';

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
 * Creates the chunks index with its mapping if it doesn't exist yet.
 * Safe to call on every server start: it's a no-op if the index is present.
 */
export async function ensureChunksIndex(): Promise<void> {
  const es = getEsClient();
  const exists = await es.indices.exists({ index: CHUNKS_INDEX });
  if (exists) return;

  await es.indices.create({
    index: CHUNKS_INDEX,
    mappings: {
      properties: {
        content: { type: 'text' },
        embedding: {
          type: 'dense_vector',
          dims: EMBEDDING_DIMS,
          index: true,
          similarity: 'cosine',
        },
        organization_id: { type: 'keyword' },
        chatbot_id: { type: 'keyword' },
        document_id: { type: 'keyword' },
        document_filename: { type: 'keyword' },
        chunk_index: { type: 'integer' },
      },
    },
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
