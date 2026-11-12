import { createHash } from 'crypto';
import type { SourceRefreshFrequency } from '@/types/database';

// Règles pures de la mise à jour automatique des pages web (docs/roadmap.md
// item 61). Le cron tourne une fois par jour : les seuils sont un peu en
// dessous de 24 h / 7 j pour qu'un léger décalage d'horaire d'exécution ne
// repousse pas une page au jour suivant.
const DAY_MS = 24 * 60 * 60 * 1000;
export const REFRESH_INTERVAL_MS: Record<Exclude<SourceRefreshFrequency, 'off'>, number> = {
  daily: 20 * 60 * 60 * 1000,
  weekly: 6.5 * DAY_MS,
};

export function isRefreshDue(
  frequency: SourceRefreshFrequency,
  lastCheckedAt: string | null,
  now: Date
): boolean {
  if (frequency === 'off') return false;
  if (!lastCheckedAt) return true;
  const last = new Date(lastCheckedAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= REFRESH_INTERVAL_MS[frequency];
}

/** Empreinte du texte extrait : sert à détecter qu'une page n'a pas changé. */
export function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export const SOURCE_REFRESH_LABELS: Record<SourceRefreshFrequency, string> = {
  off: 'Désactivée',
  daily: 'Tous les jours',
  weekly: 'Toutes les semaines',
};

export function isSourceRefreshFrequency(v: unknown): v is SourceRefreshFrequency {
  return v === 'off' || v === 'daily' || v === 'weekly';
}
