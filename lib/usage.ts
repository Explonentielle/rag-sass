import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OrgPlan, OrgOverageMode } from '@/types/database';
import { PLAN_LIMITS } from '@/lib/plans';
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

/** Date-only (YYYY-MM-DD) form of the same month boundary, for matching
 * `overage_charges.period_start` (a `date` column) — shared by the
 * reconciliation cron and the dashboard's overage display so both agree
 * on the exact same value. */
export function startOfCurrentMonthDate(): string {
  return startOfCurrentMonthUtc().slice(0, 10);
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

/**
 * Real enforcement hook (docs/roadmap.md items 17/36) — reused by both
 * chat routes (app/api/chat/route.ts, app/api/public-chat/route.ts).
 * `block`: refuse once the plan's included quota is reached (`null`
 * limit, i.e. "Métier sur devis", is never blocked). `auto_bill`: never
 * blocked here — the overage is billed after the fact by
 * app/api/cron/charge-overage/route.ts, not checked synchronously on the
 * hot chat path.
 */
export async function checkQuota(
  supabase: SupabaseClient<Database>,
  params: { organizationId: string; plan: OrgPlan; overageMode: OrgOverageMode }
): Promise<{ blocked: boolean; messagesThisMonth: number }> {
  const { organizationId, plan, overageMode } = params;
  const messagesThisMonth = await getMonthlyMessageCount(supabase, organizationId);
  const limit = PLAN_LIMITS[plan];

  const blocked = overageMode === 'block' && limit !== null && messagesThisMonth >= limit;
  return { blocked, messagesThisMonth };
}
