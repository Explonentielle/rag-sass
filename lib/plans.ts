import type { OrgPlan, OrgOverageMode } from '@/types/database';

/**
 * Plan constants only, deliberately split out of lib/usage.ts so this stays
 * importable from client components (e.g. OrgSettingsForm.tsx's plan
 * selector). lib/usage.ts pulls in lib/logger.ts (writes to the filesystem,
 * Node-only) for getMonthlyMessageCount's error logging; a client component
 * importing anything from that module, even just these constants, drags
 * lib/logger.ts's `node:path`/`fs` imports into the browser bundle and
 * breaks the build. See docs/roadmap.md item 17.
 */

// 'free' (docs/roadmap.md item 34): the real default for any org with no
// Stripe subscription, deliberately much lower than Solo's 400, so
// paying for Solo actually buys something.
//
// Solo/PME recalibrated 2026-11-05 (item 56): a token-budget estimate
// against gpt-5.6-luna's public pricing ($0.20/1M in, $1.20/1M out) and
// text-embedding-3-small ($0.02/1M) puts the OpenAI cost of one grounded
// chat message (query rewrite + embedding + rerank over 15 candidate
// chunks + final answer) at roughly 0.003€, dominated by rerankChunks
// sending the full 15-chunk candidate pool to the model. At these
// quotas that's ~9€/month of OpenAI cost on PME (49€) and under 2€ on
// Solo (9€), comfortable margin on both. PME's quota/price ratio is
// deliberately higher than Solo's, not just the same ratio scaled up,
// since token cost isn't the constraint: it makes PME look like the
// better deal and nudges Solo orgs to upgrade. This is an estimate
// from code constants and public pricing, not a measurement off real
// OpenAI billing (see item 35, still open for that).
export const PLAN_LIMITS: Record<OrgPlan, number | null> = {
  free: 30,
  solo: 400,
  pme: 3000,
  metier: null, // "sur devis", no fixed quota to compare against
};

// Entitlement caps (docs/roadmap.md item 56), enforced at creation time
// only (app/api/chatbots/route.ts, app/api/organizations/[id]/members/
// route.ts): never retroactively removes an existing chatbot/member if
// an org's plan changes. null = unlimited.
export const PLAN_CHATBOT_LIMITS: Record<OrgPlan, number | null> = {
  free: 1,
  solo: 1,
  pme: null,
  metier: null,
};

export const PLAN_MEMBER_LIMITS: Record<OrgPlan, number | null> = {
  free: 1,
  solo: 1,
  pme: null,
  metier: null,
};

export const PLAN_LABELS: Record<OrgPlan, string> = {
  free: 'Gratuit',
  solo: 'Solo',
  pme: 'PME',
  metier: 'Métier',
};

// Display only (matches app/page.tsx's Pricing section). The actual
// amount charged lives in Stripe itself (STRIPE_PRICE_SOLO/PME).
export const PLAN_PRICE_LABELS: Record<'solo' | 'pme', string> = {
  solo: '9€ / mois',
  pme: '49€ / mois',
};

// Reuses app/page.tsx's Pricing section copy so the dashboard and the
// public landing page never describe a plan differently.
export const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  free: ['1 assistant, idéal pour tester', 'Widget intégrable sur votre site', 'Historique de conversation limité'],
  solo: ['1 assistant, avec ou sans documents', 'Widget intégrable sur votre site', 'Historique de conversation conservé'],
  pme: [
    'Assistants illimités',
    'Formats étendus : CSV, Excel, multi-documents',
    "Membres d'équipe multiples",
    'Analyseur de contrats (IA)',
  ],
  metier: ['Fonctionnalités de la feuille de route en priorité', 'Accompagnement à la mise en place', 'Facturation adaptée au volume réel'],
};

/**
 * Plans entitled to AI-assisted indexing (docs/roadmap.md item 18), a
 * premium feature with a real per-document LLM cost, unlike the rest of
 * the pipeline. Enforced in app/api/chatbots/[id]/route.ts; soft-gated
 * like everything else plan-related (item 17: the plan label itself
 * isn't billing-enforced yet).
 */
export const AI_INDEXING_ALLOWED_PLANS: OrgPlan[] = ['pme', 'metier'];

/**
 * Plans entitled to the contract analyzer (docs/roadmap.md item 23), a
 * premium feature for the same reason as AI indexing above (real per-document
 * LLM cost). Enforced at creation time in app/api/chatbots/route.ts.
 */
export const CONTRACT_ANALYZER_ALLOWED_PLANS: OrgPlan[] = ['pme', 'metier'];

/**
 * Overage billing (docs/roadmap.md items 17/36). Messages per block and
 * price per block once a plan's included quota is exceeded in
 * `overage_mode: 'auto_bill'` (see lib/usage.ts checkQuota, lib/stripe.ts
 * chargeOverage). PLACEHOLDER business values, explicitly not final
 * (the user hasn't settled on an exact amount yet). Confirm real numbers
 * before enabling auto_bill against a live (non-test) Stripe account.
 */
export const OVERAGE_BLOCK_SIZE = 100;
export const OVERAGE_CHARGE_CENTS = 500;

export const OVERAGE_MODE_LABELS: Record<OrgOverageMode, string> = {
  block: 'Bloquer au quota',
  auto_bill: 'Débit automatique',
};
