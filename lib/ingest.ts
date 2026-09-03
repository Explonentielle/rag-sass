import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { extractText, UnsupportedDocumentError, type SupportedFileType } from '@/lib/extract';
import { chunkText } from '@/lib/chunking';
import { embedTexts } from '@/lib/openai';
import { ensureChunksIndex, getEsClient, CHUNKS_INDEX, type ChunkDoc } from '@/lib/elasticsearch';
import { logInfo, logError } from '@/lib/logger';

const EMBEDDING_BATCH_SIZE = 50;

export interface ProcessDocumentParams {
  documentId: string;
  chatbotId: string;
  organizationId: string;
  storagePath: string;
  fileType: SupportedFileType;
  filename: string;
}

/**
 * Runs the full ingestion pipeline for one document, synchronously, updating
 * its status in Postgres at each step: pending -> processing -> indexed|error.
 *
 * Run inline in the upload request for this MVP (no job queue yet); fine
 * for the pilot's document sizes; move to a background worker if uploads
 * start timing out.
 */
export async function processDocument(
  supabase: SupabaseClient<Database>,
  params: ProcessDocumentParams
): Promise<{ status: 'indexed' | 'error'; errorMessage?: string; chunkCount?: number }> {
  const { documentId, chatbotId, organizationId, storagePath, fileType, filename } = params;
  const logCtx = { documentId, chatbotId, organizationId, filename, fileType };

  logInfo('ingest.start', logCtx);

  try {
    await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId);

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);
    if (downloadError || !fileBlob) {
      throw new Error(`Téléchargement du fichier échoué: ${downloadError?.message}`);
    }
    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    const text = await extractText(buffer, fileType);
    const chunks = chunkText(text);
    logInfo('ingest.chunked', { ...logCtx, chunkCount: chunks.length, textLength: text.length });

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
