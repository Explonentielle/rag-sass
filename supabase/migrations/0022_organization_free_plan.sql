-- ============================================================================
-- Real free tier (docs/roadmap.md item 34). Until now, an org with no
-- Stripe subscription defaulted to plan='solo' — the exact same label
-- and 300 msg/month quota as a paying Solo customer, which killed any
-- incentive to actually pay for Solo. 'free' is its own value with its
-- own (much lower) quota, see lib/plans.ts PLAN_LIMITS.
-- ============================================================================

alter table organizations
  alter column plan set default 'free';

alter table organizations
  drop constraint if exists organizations_plan_check;

alter table organizations
  add constraint organizations_plan_check
  check (plan in ('free', 'solo', 'pme', 'metier'));

-- Backfill only the actual bug case: orgs sitting on the old default
-- ('solo') with no real Stripe subscription ever behind it. Orgs
-- manually set to pme/metier by an admin (the pre-Stripe "pilote
-- facturé à la main" flow, still supported) are left untouched — that
-- was a deliberate choice, not an accidental default.
update organizations
set plan = 'free'
where plan = 'solo' and stripe_subscription_id is null;
