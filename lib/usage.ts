import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OrgPlan } from '@/types/database';
import { logError } from '@/lib/logger';

/**
 * Message usage measurement (roadmap.md item 17). The landing page quotes
 * precise quotas (Solo 300, PME 1 500, Métier "sur devis") — this makes
 * that number real instead of decorative. `organizations.plan` is a label
 * an org admin sets manually (Paramètres > Organisation), not something a
 * payment enforces — there's no billing integration behind it. Treat
 * `PLAN_LIMITS` as informational (dashboard display), not a hard gate:
 * nothing here blocks a message once an org is over its limit.
 */

export const PLAN_LIMITS: Record<OrgPlan, number | null> = {
  solo: 300,
  pme: 1500,
  metier: null, // "sur devis" — no fixed quota to compare against
};

export const PLAN_LABELS: Record<OrgPlan, string> = {
  solo: 'Solo',
  pme: 'PME',
  metier: 'Métier',
};

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
