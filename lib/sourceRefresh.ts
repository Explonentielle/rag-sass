import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, DocumentStatus } from '@/types/database';
import { extractFromUrl } from '@/lib/extract';
import { reindexDocumentFromText } from '@/lib/ingest';
import { hashText } from '@/lib/sourceRefreshRules';
import { logInfo, logWarn } from '@/lib/logger';

// Re-lecture d'une page web déjà indexée (docs/roadmap.md item 61). Appelée
// par le cron quotidien et par le bouton « Actualiser » du dashboard.

export interface RefreshableDocument {
  id: string;
  chatbot_id: string;
  source_url: string | null;
  content_hash: string | null;
  status: DocumentStatus;
}

export interface RefreshChatbot {
  id: string;
  organization_id: string;
  use_ai_indexing: boolean;
}

export type RefreshOutcome = { outcome: 'unchanged' | 'updated' } | { outcome: 'failed'; error: string };

export async function refreshUrlDocument(
  supabase: SupabaseClient<Database>,
  doc: RefreshableDocument,
  chatbot: RefreshChatbot
): Promise<RefreshOutcome> {
  const url = doc.source_url;
  const logCtx = { documentId: doc.id, chatbotId: chatbot.id, url };
  if (!url) return { outcome: 'failed', error: "Ce document n'a pas d'adresse source." };

  const markChecked = () =>
    supabase.from('documents').update({ last_checked_at: new Date().toISOString() }).eq('id', doc.id);

  // Fetch first: a page that is down or blocked must leave the existing
  // chunks untouched (the old content is still better than none).
  let text: string;
  try {
    text = await extractFromUrl(url);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Lecture de la page impossible.';
    logWarn('source_refresh.fetch_failed', { ...logCtx, error });
    await markChecked();
    return { outcome: 'failed', error };
  }

  const hash = hashText(text);
  if (doc.status === 'indexed' && doc.content_hash === hash) {
    await markChecked();
    logInfo('source_refresh.unchanged', logCtx);
    return { outcome: 'unchanged' };
  }

  const result = await reindexDocumentFromText(supabase, {
    documentId: doc.id,
    chatbotId: chatbot.id,
    organizationId: chatbot.organization_id,
    filename: url,
    text,
    useAiIndexing: chatbot.use_ai_indexing,
  });

  if (result.status !== 'indexed') {
    await markChecked();
    return { outcome: 'failed', error: result.errorMessage ?? "L'indexation a échoué." };
  }

  await supabase
    .from('documents')
    .update({ content_hash: hash, last_checked_at: new Date().toISOString() })
    .eq('id', doc.id);
  logInfo('source_refresh.updated', { ...logCtx, chunkCount: result.chunkCount });
  return { outcome: 'updated' };
}
