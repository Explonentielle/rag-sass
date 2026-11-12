import { describe, it, expect } from 'vitest';
import { hashText, isRefreshDue, isSourceRefreshFrequency } from './sourceRefreshRules';

const NOW = new Date('2026-11-12T05:00:00Z');

describe('isRefreshDue', () => {
  it("n'est jamais due quand la mise à jour est désactivée", () => {
    expect(isRefreshDue('off', null, NOW)).toBe(false);
    expect(isRefreshDue('off', '2020-01-01T00:00:00Z', NOW)).toBe(false);
  });

  it('est due si la page na jamais été vérifiée', () => {
    expect(isRefreshDue('daily', null, NOW)).toBe(true);
    expect(isRefreshDue('weekly', null, NOW)).toBe(true);
  });

  it('quotidien : due après 20 h, pas avant', () => {
    expect(isRefreshDue('daily', '2026-11-11T08:00:00Z', NOW)).toBe(true);
    expect(isRefreshDue('daily', '2026-11-11T12:00:00Z', NOW)).toBe(false);
  });

  it('hebdomadaire : due après 6,5 jours, pas avant', () => {
    expect(isRefreshDue('weekly', '2026-11-05T05:00:00Z', NOW)).toBe(true);
    expect(isRefreshDue('weekly', '2026-11-08T05:00:00Z', NOW)).toBe(false);
  });

  it('traite une date illisible comme due', () => {
    expect(isRefreshDue('daily', 'pas-une-date', NOW)).toBe(true);
  });
});

describe('hashText', () => {
  it('est stable et sensible au contenu', () => {
    expect(hashText('bonjour')).toBe(hashText('bonjour'));
    expect(hashText('bonjour')).not.toBe(hashText('bonjour '));
    expect(hashText('x')).toHaveLength(64);
  });
});

describe('isSourceRefreshFrequency', () => {
  it('accepte les trois valeurs et rejette le reste', () => {
    expect(isSourceRefreshFrequency('off')).toBe(true);
    expect(isSourceRefreshFrequency('daily')).toBe(true);
    expect(isSourceRefreshFrequency('weekly')).toBe(true);
    expect(isSourceRefreshFrequency('hourly')).toBe(false);
    expect(isSourceRefreshFrequency(null)).toBe(false);
  });
});
