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
// Stripe subscription, deliberately much lower than Solo's 300, so
// paying for Solo actually buys something. PLACEHOLDER value (30),
// trivial to change later.
export const PLAN_LIMITS: Record<OrgPlan, number | null> = {
  free: 30,
  solo: 300,
  pme: 1500,
  metier: null, // "sur devis", no fixed quota to compare against
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
  pme: ['Assistants illimités', 'Formats étendus : CSV, Excel, multi-documents', "Membres d'équipe multiples"],
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
