-- ============================================================================
-- Stripe billing fields (docs/roadmap.md item 17). Groundwork only: these
-- columns let a future webhook keep `organizations.plan` (item 9) in sync
-- with a real subscription, without anything calling Stripe yet — no
-- Checkout session creation in this app, deliberately (see item 17): the
-- plan is to use Stripe Payment Links (no-code, created in the Stripe
-- dashboard) with ?client_reference_id=<organization_id> appended, so the
-- webhook (app/api/webhooks/stripe/route.ts) can map a completed payment
-- back to an organization without any checkout code on our side.
-- ============================================================================

alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text;

comment on column organizations.stripe_customer_id is
  'Set by the Stripe webhook on checkout.session.completed. Null until the org has paid at least once.';
comment on column organizations.stripe_subscription_id is
  'Set by the Stripe webhook. Null for orgs on a manually-set plan (no real subscription yet).';
comment on column organizations.stripe_subscription_status is
  'Mirrors Stripe''s subscription status (active, past_due, canceled...) — set by the webhook on customer.subscription.updated/deleted. Not billing-enforced anywhere yet (see lib/usage.ts): informational, for the day a plan limit needs to react to a failed payment.';

create unique index if not exists organizations_stripe_customer_id_idx
  on organizations (stripe_customer_id)
  where stripe_customer_id is not null;
