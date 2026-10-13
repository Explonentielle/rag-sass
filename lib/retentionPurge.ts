import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { removeConversationFiles } from '@/lib/conversationFiles';
import { logInfo, logError } from '@/lib/logger';

// Kept in sync by hand with the interval in supabase/migrations/0006 (now
// unscheduled, see migration 0018) — 90 days, a pilot default, not a hard
// constraint.
export const RETENTION_DAYS = 90;

/**
 * Purges conversations inactive for more than RETENTION_DAYS, Storage
 * objects included (docs/roadmap.md item 48's known gap). Why this replaced
 * the old pg_cron-only job (migration 0006): pg_cron can delete SQL rows,
 * but it can't reach Supabase Storage to remove the matching file objects —
 * `conversation_files` rows (and the storage_path they hold) cascade away
 * the instant their conversation is deleted, so a SQL-only purge silently
 * orphaned every visitor-uploaded file forever. This function cleans
 * Storage *first*, while those paths still exist, then deletes the rows.
 */
export async function purgeExpiredConversations(
  admin: SupabaseClient<Database>
): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await admin
    .from('conversations')
    .select('id')
    .lt('updated_at', cutoff);

  if (error) {
    logError('retention_purge.query_failed', { error: error.message });
    throw new Error(`Échec de la requête de purge: ${error.message}`);
  }

  const ids = (expired ?? []).map((c) => c.id);
  if (ids.length === 0) {
    logInfo('retention_purge.done', { purged: 0 });
    return { purged: 0 };
  }

  // Storage first: once the conversations below are deleted, the
  // conversation_files rows (and the storage_path they hold) cascade away
  // with them — nothing could find those paths to clean afterwards.
  await removeConversationFiles(admin, { conversationIds: ids });

  const { error: deleteError } = await admin.from('conversations').delete().in('id', ids);
  if (deleteError) {
    logError('retention_purge.delete_failed', { error: deleteError.message, count: ids.length });
    throw new Error(`Échec de la suppression: ${deleteError.message}`);
  }

  logInfo('retention_purge.done', { purged: ids.length });
  return { purged: ids.length };
}
