// Tests pour lib/stripe.ts — uniquement planForPriceId, la fonction pure
// (pas de mock du SDK Stripe nécessaire). getStripeClient() n'est pas
// testé ici : juste un singleton paresseux, même genre que getEsClient/
// getOpenAiClient, qui lève une erreur explicite si la clé API manque.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { planForPriceId } from './stripe';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.STRIPE_PRICE_SOLO = 'price_solo_test';
  process.env.STRIPE_PRICE_PME = 'price_pme_test';
  process.env.STRIPE_PRICE_METIER = 'price_metier_test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('planForPriceId', () => {
  it('maps each configured price id to its plan', () => {
    expect(planForPriceId('price_solo_test')).toBe('solo');
    expect(planForPriceId('price_pme_test')).toBe('pme');
    expect(planForPriceId('price_metier_test')).toBe('metier');
  });

  it('returns null for a price id that is not one of ours', () => {
    expect(planForPriceId('price_unrelated')).toBeNull();
  });

  it('returns null for an empty price id even if a plan env var is unset', () => {
    // Un env var non configuré vaut '' (chaîne vide) dans le mapping — un
    // price_id vide ne doit jamais matcher accidentellement cette entrée.
    delete process.env.STRIPE_PRICE_METIER;
    expect(planForPriceId('')).toBeNull();
  });
});
