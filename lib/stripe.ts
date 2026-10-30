import Stripe from 'stripe';
import type { OrgPlan } from '@/types/database';

let client: Stripe | null = null;

/**
 * Stripe client, lazy singleton — same pattern as getEsClient/getOpenAiClient.
 * Undefined STRIPE_SECRET_KEY throws on first use rather than silently
 * no-op'ing, same philosophy as lib/crypto.ts's getKey().
 */
export function getStripeClient(): Stripe {
  if (client) return client;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY manquante — voir docs/deployment.md.');
  }

  client = new Stripe(apiKey);
  return client;
}

/**
 * Maps a Stripe Price id to one of our plan labels (docs/roadmap.md item
 * 17) — env-var driven rather than hardcoded, so creating the actual
 * Stripe products/prices (dashboard-only, no code) is the only step left
 * once this is deployed: set STRIPE_PRICE_SOLO/PME/METIER and the mapping
 * just works. Returns null for a price that isn't one of ours (ignored by
 * the webhook rather than treated as an error — could be an unrelated
 * Stripe object in the same account).
 */
export function planForPriceId(priceId: string): OrgPlan | null {
  if (!priceId) return null;

  const entries: [string | undefined, OrgPlan][] = [
    [process.env.STRIPE_PRICE_SOLO, 'solo'],
    [process.env.STRIPE_PRICE_PME, 'pme'],
    [process.env.STRIPE_PRICE_METIER, 'metier'],
  ];
  // Skip unconfigured env vars rather than folding them into the mapping
  // as '' — an empty key would otherwise make a falsy/empty priceId match
  // whichever plan isn't set up yet, which is exactly the state during a
  // partial rollout (products created one plan at a time).
  const found = entries.find(([envValue]) => envValue && envValue === priceId);
  return found?.[1] ?? null;
}

/**
 * Off-session charge for a quota overage block (docs/roadmap.md items
 * 17/36, `overage_mode: 'auto_bill'`). Called only from the daily
 * reconciliation cron (app/api/cron/charge-overage/route.ts), never from
 * a request a user is actively waiting on.
 *
 * Payment method resolution: tries the subscription's own default first
 * (set when the org paid via a Stripe Payment Link in subscription
 * mode), falls back to the customer's first saved card. Which of the two
 * is actually populated after a Payment Link checkout isn't 100%
 * guaranteed by Stripe's docs — verify empirically in test mode before
 * relying on this in production.
 */
export async function chargeOverage(
  stripe: Stripe,
  params: { customerId: string; subscriptionId: string | null; amountCents: number }
): Promise<Stripe.PaymentIntent> {
  const { customerId, subscriptionId, amountCents } = params;

  let paymentMethodId: string | null = null;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    paymentMethodId =
      typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : (subscription.default_payment_method?.id ?? null);
  }
  if (!paymentMethodId) {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    paymentMethodId = methods.data[0]?.id ?? null;
  }
  if (!paymentMethodId) {
    throw new Error(`Aucun moyen de paiement enregistré pour le client Stripe ${customerId}.`);
  }

  return stripe.paymentIntents.create({
    customer: customerId,
    amount: amountCents,
    currency: 'eur',
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
  });
}
