import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient, planForPriceId } from '@/lib/stripe';
import { getAdminClient } from '@/lib/supabase/admin';
import { logInfo, logWarn, logError } from '@/lib/logger';

/**
 * Stripe webhook (docs/roadmap.md item 17). Deliberately the only Stripe
 * touchpoint in this app for now — no Checkout session creation here,
 * see lib/stripe.ts's comment. Keeps `organizations.plan` (and the new
 * stripe_* columns, migration 0011) in sync with whatever happens on
 * Stripe's side (a Payment Link payment, a cancellation, a failed
 * renewal), regardless of how the subscription was actually created.
 *
 * Needs the RAW request body (not JSON-parsed) for signature
 * verification — Next.js doesn't parse the body for us unless we call
 * .json()/.text() ourselves, so this is safe by default, but don't
 * refactor this to read req.json() first.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logError('stripe_webhook.not_configured', { hasSignature: !!signature });
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logWarn('stripe_webhook.bad_signature', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  const admin = getAdminClient();

  try {
    switch (event.type) {
      // Fired once when a Payment Link checkout completes. We rely on
      // ?client_reference_id=<organization_id> being appended to the
      // Payment Link URL (set up in the Stripe dashboard, see
      // docs/deployment.md) to know which org just paid — Stripe passes
      // that straight through to this field, no checkout code needed.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (!organizationId || !customerId) {
          logWarn('stripe_webhook.checkout_missing_reference', {
            hasOrganizationId: !!organizationId,
            hasCustomerId: !!customerId,
          });
          break;
        }

        let plan: ReturnType<typeof planForPriceId> = null;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId) plan = planForPriceId(priceId);
        }

        const { error } = await admin
          .from('organizations')
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
            stripe_subscription_status: subscriptionId ? 'active' : null,
            ...(plan ? { plan } : {}),
          })
          .eq('id', organizationId);

        if (error) {
          logError('stripe_webhook.checkout_update_failed', { organizationId, error: error.message });
        } else {
          logInfo('stripe_webhook.checkout_completed', { organizationId, plan });
        }
        break;
      }

      // Renewal, upgrade/downgrade, or a failed-payment status change.
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? planForPriceId(priceId) : null;

        const { error } = await admin
          .from('organizations')
          .update({
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: subscription.status,
            ...(plan ? { plan } : {}),
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          logError('stripe_webhook.subscription_update_failed', { customerId, error: error.message });
        } else {
          logInfo('stripe_webhook.subscription_updated', { customerId, status: subscription.status, plan });
        }
        break;
      }

      // Subscription actually ends (not just a failed payment) — fall
      // back to the lowest paid plan rather than leaving a stale
      // "pme"/"metier" label with nothing backing it. No free plan yet
      // (item 34); revisit this fallback once one exists.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

        const { error } = await admin
          .from('organizations')
          .update({
            stripe_subscription_id: null,
            stripe_subscription_status: 'canceled',
            plan: 'solo',
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          logError('stripe_webhook.subscription_delete_failed', { customerId, error: error.message });
        } else {
          logInfo('stripe_webhook.subscription_deleted', { customerId });
        }
        break;
      }

      default:
        // Plenty of other event types exist on the same Stripe account
        // (e.g. invoice.*) — ignored, not an error.
        break;
    }
  } catch (err) {
    logError('stripe_webhook.handler_failed', {
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still 200: Stripe retries on non-2xx, which would just repeat the
    // same failure. Logged above for investigation instead.
  }

  return NextResponse.json({ received: true });
}
