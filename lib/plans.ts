import type { OrgPlan } from '@/types/database';

/**
 * Plan constants only — deliberately split out of lib/usage.ts so this stays
 * importable from client components (e.g. OrgSettingsForm.tsx's plan
 * selector). lib/usage.ts pulls in lib/logger.ts (writes to the filesystem,
 * Node-only) for getMonthlyMessageCount's error logging; a client component
 * importing anything from that module — even just these constants — drags
 * lib/logger.ts's `node:path`/`fs` imports into the browser bundle and
 * breaks the build. See docs/roadmap.md item 17.
 */

export const PLAN_LIMITS: Record<OrgPlan, number | null> = {
  solo: 300,
  pme: 1500,
  metier: null, // "sur devis" — no fixed quota to compare against
};

export const PLAN_LABELS: Record<OrgPlan, string> = {
  solo: 'Solo',
  pme: 'PME',
  metier: 'Métier',
};
