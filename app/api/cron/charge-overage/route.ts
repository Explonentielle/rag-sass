import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getStripeClient, chargeOverage } from '@/lib/stripe';
import { getMonthlyMessageCount, startOfCurrentMonthDate } from '@/lib/usage';
import { PLAN_LIMITS, OVERAGE_BLOCK_SIZE, OVERAGE_CHARGE_CENTS } from '@/lib/plans';
import { logInfo, logWarn, logError } from '@/lib/logger';
import type { OrgPlan } from '@/types/database';

interface OverageOrgRow {
  id: string;
  plan: OrgPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

// Same reasoning as app/api/cron/purge-conversations/route.ts: forces
// this off the static-optimization path so it only runs on the real
// Vercel Cron schedule, not once at build time.
export const dynamic = 'force-dynamic';

/**
 * Daily reconciliation (docs/roadmap.md items 17/36, scheduled in
 * vercel.json) for organizations on `overage_mode: 'auto_bill'`: charges
 * whatever blocks of overage haven't been billed yet this month.
 * Idempotent via the `overage_charges` ledger (only `succeeded` rows
 * count as "already charged" — a failed attempt is retried the next
 * day automatically, no separate retry/backoff logic needed).
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const admin = getAdminClient();
  const periodStart = startOfCurrentMonthDate();
  const results = { charged: 0, skipped: 0, failed: 0 };

  try {
    const { data: orgs, error: orgsError } = await admin
      .from('organizations')
      .select('id, plan, stripe_customer_id, stripe_subscription_id')
      .eq('overage_mode', 'auto_bill')
      .not('stripe_customer_id', 'is', null)
      .returns<OverageOrgRow[]>();

    if (orgsError) throw orgsError;

    for (const org of orgs ?? []) {
      const limit = PLAN_LIMITS[org.plan];
      if (limit === null || !org.stripe_customer_id) {
        results.skipped += 1;
        continue;
      }

      const messagesThisMonth = await getMonthlyMessageCount(admin, org.id);
      const blocksOver = Math.floor(Math.max(0, messagesThisMonth - limit) / OVERAGE_BLOCK_SIZE);
      if (blocksOver === 0) {
        results.skipped += 1;
        continue;
      }

      const { data: charges, error: chargesError } = await admin
        .from('overage_charges')
        .select('blocks_charged')
        .eq('organization_id', org.id)
        .eq('period_start', periodStart)
        .eq('status', 'succeeded');
      if (chargesError) throw chargesError;

      const alreadyCharged = (charges ?? []).reduce((sum, c) => sum + c.blocks_charged, 0);
      const blocksToCharge = blocksOver - alreadyCharged;
      if (blocksToCharge <= 0) {
        results.skipped += 1;
        continue;
      }

      const amountCents = blocksToCharge * OVERAGE_CHARGE_CENTS;
      try {
        const stripe = getStripeClient();
        const paymentIntent = await chargeOverage(stripe, {
          customerId: org.stripe_customer_id,
          subscriptionId: org.stripe_subscription_id,
          amountCents,
        });
        await admin.from('overage_charges').insert({
          organization_id: org.id,
          period_start: periodStart,
          blocks_charged: blocksToCharge,
          amount_cents: amountCents,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'succeeded',
        });
        results.charged += 1;
        logInfo('cron.charge_overage_succeeded', { organizationId: org.id, blocksToCharge, amountCents });
      } catch (err) {
        await admin.from('overage_charges').insert({
          organization_id: org.id,
          period_start: periodStart,
          blocks_charged: blocksToCharge,
          amount_cents: amountCents,
          status: 'failed',
        });
        results.failed += 1;
        logWarn('cron.charge_overage_failed', {
          organizationId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('cron.charge_overage_run_failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
