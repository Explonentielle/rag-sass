-- ============================================================================
-- Organization plan label (docs/roadmap.md item 17). The landing page quotes
-- three named plans (Solo/PME/Métier) with per-plan message quotas, but
-- nothing anywhere stored which plan an org is actually on — so the message
-- count added in lib/usage.ts had nothing to compare against. This is
-- deliberately just a label + a hardcoded limit (see lib/usage.ts
-- PLAN_LIMITS), set manually by an org admin in Paramètres — not tied to any
-- real payment. A real billing integration (Stripe or equivalent) is a
-- separate, larger piece of work; this only makes the number on the
-- dashboard mean something in the meantime.
-- ============================================================================

alter table organizations
  add column if not exists plan text not null default 'solo'
    check (plan in ('solo', 'pme', 'metier'));

comment on column organizations.plan is
  'Manually set by an org admin (Paramètres > Organisation) — not billing-enforced. See lib/usage.ts PLAN_LIMITS for what each plan quotes on the landing page.';
