import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MessageFeedback } from '@/types/database';
import { logError } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** 1 / -1 set a rating, null or 0 clears it, anything else is invalid (undefined). */
export function parseFeedbackValue(raw: unknown): MessageFeedback | null | undefined {
  if (raw === 1 || raw === -1) return raw;
  if (raw === null || raw === 0) return null;
  return undefined;
}

/**
 * Rates one assistant answer (roadmap item 59). Callers must have already
 * verified that `conversationId` belongs to the caller — this only scopes the
 * update to that conversation and to assistant rows, so a messageId from
 * another conversation can't be rated through a conversation the caller owns.
 * Returns false when no such assistant message exists.
 */
export async function setAssistantMessageFeedback(
  admin: SupabaseClient<Database>,
  params: { conversationId: string; messageId: string; value: MessageFeedback | null }
): Promise<boolean> {
  const { conversationId, messageId, value } = params;
  const { data, error } = await admin
    .from('messages')
    .update({ feedback: value })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .select('id');

  if (error) {
    logError('feedback.update_failed', { conversationId, messageId, error: error.message });
    throw new Error(`Impossible d'enregistrer le retour: ${error.message}`);
  }
  return (data?.length ?? 0) > 0;
}
