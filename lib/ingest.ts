import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { extractText, extractFromUrl, UnsupportedDocumentError, type SupportedFileType } from '@/lib/extract';
import { chunkText } from '@/lib/chunking';
import { embedTexts, structureChunksWithAI } from '@/lib/openai';
import { ensureChunksIndex, getEsClient, CHUNKS_INDEX, type ChunkDoc } from '@/lib/elasticsearch';
import { logInfo, logError } from '@/lib/logger';

const EMBEDDING_BATCH_SIZE = 50;

interface IngestionContext {
  documentId: string;
  chatbotId: string;
  organizationId: string;
  filename: string;
}

interface ResolvedChunks {
  chunks: string[];
  usedAiIndexing: boolean;
  aiIndexingRequested: boolean;
}

/**
 * Shared tail of the ingestion pipeline, common to a file upload and a URL
 * scrape: both resolve down to "here's the raw extracted text, go chunk it
 * (mechanically or via AI), embed it, index it in ES, and update the
 * document's status." Everything specific to *how* the text was obtained
 * lives in `getChunks` (download+extractText for a file, fetch+Readability
 * for a URL) — this function owns the status transitions
 * (pending -> processing -> indexed|error) and all the logging/error
 * handling, so neither caller has to duplicate it.
 */
async function runIngestion(
  supabase: SupabaseClient<Database>,
  ctx: IngestionContext,
  getChunks: () => Promise<ResolvedChunks>
): Promise<{ status: 'indexed' | 'error'; errorMessage?: string; chunkCount?: number }> {
  const { documentId, chatbotId, organizationId, filename } = ctx;
  const logCtx = { documentId, chatbotId, organizationId, filename };

  logInfo('ingest.start', logCtx);

  try {
    await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);

    const { chunks, usedAiIndexing, aiIndexingRequested } = await getChunks();
    logInfo('ingest.chunked', {
      ...logCtx,
      chunkCount: chunks.length,
      usedAiIndexing,
      aiIndexingRequested,
    });

    if (chunks.length === 0) {
      throw new UnsupportedDocumentError('Aucun contenu exploitable trouvé dans ce document.');
    }

    await ensureChunksIndex();

    const es = getEsClient();
    let indexedCount = 0;

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const embeddings = await embedTexts(batch);

      const operations = batch.flatMap((content, j) => {
        const doc: ChunkDoc = {
          content,
          embedding: embeddings[j],
          organization_id: organizationId,
          chatbot_id: chatbotId,
          document_id: documentId,
          document_filename: filename,
          chunk_index: i + j,
        };
        return [{ index: { _index: CHUNKS_INDEX } }, doc];
      });

      await es.bulk({ operations, refresh: false });
      indexedCount += batch.length;
    }

    await es.indices.refresh({ index: CHUNKS_INDEX });

    await supabase
      .from('documents')
      .update({
        status: 'indexed',
        chunk_count: indexedCount,
        indexed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', documentId);

    logInfo('ingest.success', { ...logCtx, chunkCount: indexedCount });
    return { status: 'indexed', chunkCount: indexedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue lors du traitement.';
    logError('ingest.failed', { ...logCtx, error: message, stack: err instanceof Error ? err.stack : undefined });

    await supabase
      .from('documents')
      .update({ status: 'error', error_message: message })
      .eq('id', documentId);

    return { status: 'error', errorMessage: message };
  }
}

// AI-assisted indexing never blocks ingestion: a failure (API error,
// unusable output) silently falls back to the mechanical chunker rather
// than failing the whole upload, same as every other best-effort LLM step
// in this app (query rewriting, reranking).
async function resolveChunks(text: string, useAiIndexing: boolean | undefined): Promise<ResolvedChunks> {
  const aiChunks = useAiIndexing ? await structureChunksWithAI(text) : null;
  return {
    chunks: aiChunks ?? chunkText(text),
    usedAiIndexing: aiChunks !== null,
    aiIndexingRequested: !!useAiIndexing,
  };
}

export interface ProcessDocumentParams {
  documentId: string;
  chatbotId: string;
  organizationId: string;
  storagePath: string;
  fileType: SupportedFileType;
  filename: string;
  // Premium (docs/roadmap.md item 18) — LLM-cleaned/segmented chunks
  // instead of the mechanical chunker. Caller (app/api/documents/upload/
  // route.ts) resolves this from chatbots.use_ai_indexing; defaults to
  // off so every other call site (scripts/smoke-test.mts) keeps working
  // unchanged.
  useAiIndexing?: boolean;
}

/**
 * Runs the full ingestion pipeline for one uploaded file, updating its
 * status in Postgres at each step: pending -> processing -> indexed|error.
 *
 * Run inline in the upload request for this MVP (no job queue yet); fine
 * for the pilot's document sizes; move to a background worker if uploads
 * start timing out.
 */
export async function processDocument(
  supabase: SupabaseClient<Database>,
  params: ProcessDocumentParams
): Promise<{ status: 'indexed' | 'error'; errorMessage?: string; chunkCount?: number }> {
  const { documentId, chatbotId, organizationId, storagePath, fileType, filename, useAiIndexing } = params;

  return runIngestion(supabase, { documentId, chatbotId, organizationId, filename }, async () => {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);
    if (downloadError || !fileBlob) {
      throw new Error(`Téléchargement du fichier échoué: ${downloadError?.message}`);
    }
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const text = await extractText(buffer, fileType);
    return resolveChunks(text, useAiIndexing);
  });
}

export interface ProcessUrlDocumentParams {
  documentId: string;
  chatbotId: string;
  organizationId: string;
  url: string;
  // Same premium flag as ProcessDocumentParams — see its comment.
  useAiIndexing?: boolean;
}

/**
 * Runs the full ingestion pipeline for one URL (docs/roadmap.md item 18,
 * point 5): fetches it, extracts its main content (lib/extract.ts's
 * extractFromUrl, Readability-based), then shares the exact same
 * chunk/embed/index tail as processDocument. The URL itself is stored as
 * the document's filename (see app/api/documents/upload-url/route.ts) —
 * also what ends up as the cited source in chat answers, which is more
 * useful here than a scraped page title.
 */
export async function processUrlDocument(
  supabase: SupabaseClient<Database>,
  params: ProcessUrlDocumentParams
): Promise<{ status: 'indexed' | 'error'; errorMessage?: string; chunkCount?: number }> {
  const { documentId, chatbotId, organizationId, url, useAiIndexing } = params;

  return runIngestion(supabase, { documentId, chatbotId, organizationId, filename: url }, async () => {
    const text = await extractFromUrl(url);
    return resolveChunks(text, useAiIndexing);
  });
}
