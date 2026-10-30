-- ============================================================================
-- Dépassement de quota au choix de l'org (docs/roadmap.md items 17/36).
-- `organizations.plan`/`PLAN_LIMITS` (lib/plans.ts) existaient déjà comme
-- simple étiquette informative — rien ne bloquait jamais un dépassement.
-- overage_mode laisse l'org choisir entre être bloquée au quota, ou
-- débitée automatiquement par tranche de dépassement (carte déjà
-- enregistrée via son abonnement Stripe — voir lib/stripe.ts
-- chargeOverage). overage_charges est le ledger d'audit/idempotence du
-- job de réconciliation (app/api/cron/charge-overage/route.ts) : il
-- recalcule combien de tranches auraient dû être facturées ce mois-ci et
-- ne facture que la différence avec ce qui y est déjà.
-- ============================================================================

alter table organizations
  add column if not exists overage_mode text not null default 'block'
    check (overage_mode in ('block', 'auto_bill'));

comment on column organizations.overage_mode is
  'block: le chat renvoie une erreur claire une fois le quota du plan dépassé. auto_bill: continue de répondre, le cron charge-overage facture la tranche de dépassement au moyen de paiement Stripe déjà enregistré. auto_bill suppose stripe_customer_id non nul (voir components/OrgSettingsForm.tsx) mais rien ne l''impose en base.';

create table if not exists overage_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period_start date not null,
  blocks_charged int not null,
  amount_cents int not null,
  stripe_payment_intent_id text,
  status text not null check (status in ('succeeded', 'failed')),
  created_at timestamptz not null default now()
);

comment on table overage_charges is
  'Ledger des débits automatiques de dépassement (lib/plans.ts OVERAGE_BLOCK_SIZE/OVERAGE_CHARGE_CENTS). Écrit uniquement par le cron (service role) ; sert aussi à afficher le total du mois sur UsageCard (app/dashboard/page.tsx).';

create index if not exists overage_charges_org_period_idx
  on overage_charges (organization_id, period_start);

alter table overage_charges enable row level security;

-- Lecture seule pour les membres de l'org (affichage dans UsageCard) ;
-- aucune policy d'écriture — seul le cron (admin/service role, qui
-- contourne RLS) insère des lignes ici.
create policy overage_charges_select on overage_charges
  for select using (is_org_member(organization_id));
