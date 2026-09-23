import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logError } from '@/lib/logger';

/**
 * Message usage measurement (roadmap.md item 17). Server-only (pulls in
 * lib/logger.ts, which touches the filesystem) — plan constants
 * (PLAN_LIMITS/PLAN_LABELS) live in lib/plans.ts instead, so a client
 * component can use them without dragging this module's Node-only
 * dependency into the browser bundle.
 */

function startOfCurrentMonthUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Assistant messages sent this month across every chatbot of an org — the
 * unit the landing page's quotas are quoted in. */
export async function getMonthlyMessageCount(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id, conversations!inner(chatbot_id, chatbots!inner(organization_id))', {
      count: 'exact',
      head: true,
    })
    .eq('role', 'assistant')
    .gte('created_at', startOfCurrentMonthUtc())
    .eq('conversations.chatbots.organization_id', organizationId);

  if (error) {
    logError('usage.get_monthly_message_count_failed', { organizationId, error: error.message });
    throw error;
  }
  return count ?? 0;
}
