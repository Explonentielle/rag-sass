// Tests pour lib/stripe.ts — uniquement planForPriceId, la fonction pure
// (pas de mock du SDK Stripe nécessaire). getStripeClient() n'est pas
// testé ici : juste un singleton paresseux, même genre que getEsClient/
// getOpenAiClient, qui lève une erreur explicite si la clé API manque.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type Stripe from 'stripe';
import { planForPriceId, chargeOverage, createCheckoutSession } from './stripe';

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

function fakeStripe(overrides: {
  subscriptionsRetrieve?: ReturnType<typeof vi.fn>;
  paymentMethodsList?: ReturnType<typeof vi.fn>;
  paymentIntentsCreate?: ReturnType<typeof vi.fn>;
  checkoutSessionsCreate?: ReturnType<typeof vi.fn>;
}) {
  return {
    subscriptions: { retrieve: overrides.subscriptionsRetrieve ?? vi.fn() },
    paymentMethods: { list: overrides.paymentMethodsList ?? vi.fn() },
    paymentIntents: { create: overrides.paymentIntentsCreate ?? vi.fn() },
    checkout: { sessions: { create: overrides.checkoutSessionsCreate ?? vi.fn() } },
  } as unknown as Stripe;
}

describe('chargeOverage', () => {
  it("uses the subscription's default payment method when set (string id)", async () => {
    const paymentIntentsCreate = vi.fn().mockResolvedValue({ id: 'pi_1' });
    const stripe = fakeStripe({
      subscriptionsRetrieve: vi.fn().mockResolvedValue({ default_payment_method: 'pm_sub' }),
      paymentIntentsCreate,
    });

    const result = await chargeOverage(stripe, {
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      amountCents: 500,
    });

    expect(result).toEqual({ id: 'pi_1' });
    expect(paymentIntentsCreate).toHaveBeenCalledWith({
      customer: 'cus_1',
      amount: 500,
      currency: 'eur',
      payment_method: 'pm_sub',
      off_session: true,
      confirm: true,
    });
  });

  it("uses the subscription's default payment method when set (expanded object)", async () => {
    const paymentIntentsCreate = vi.fn().mockResolvedValue({ id: 'pi_2' });
    const stripe = fakeStripe({
      subscriptionsRetrieve: vi.fn().mockResolvedValue({ default_payment_method: { id: 'pm_obj' } }),
      paymentIntentsCreate,
    });

    await chargeOverage(stripe, { customerId: 'cus_1', subscriptionId: 'sub_1', amountCents: 500 });

    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'pm_obj' })
    );
  });

  it('falls back to the customer\'s saved card when the subscription has none', async () => {
    const paymentIntentsCreate = vi.fn().mockResolvedValue({ id: 'pi_3' });
    const stripe = fakeStripe({
      subscriptionsRetrieve: vi.fn().mockResolvedValue({ default_payment_method: null }),
      paymentMethodsList: vi.fn().mockResolvedValue({ data: [{ id: 'pm_card_1' }] }),
      paymentIntentsCreate,
    });

    await chargeOverage(stripe, { customerId: 'cus_1', subscriptionId: 'sub_1', amountCents: 500 });

    expect(paymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'pm_card_1' })
    );
  });

  it('falls back directly to the saved card when no subscriptionId is given', async () => {
    const paymentMethodsList = vi.fn().mockResolvedValue({ data: [{ id: 'pm_card_2' }] });
    const subscriptionsRetrieve = vi.fn();
    const stripe = fakeStripe({
      subscriptionsRetrieve,
      paymentMethodsList,
      paymentIntentsCreate: vi.fn().mockResolvedValue({ id: 'pi_4' }),
    });

    await chargeOverage(stripe, { customerId: 'cus_1', subscriptionId: null, amountCents: 500 });

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(paymentMethodsList).toHaveBeenCalledWith({ customer: 'cus_1', type: 'card' });
  });

  it('throws a clear error when no payment method can be found at all', async () => {
    const stripe = fakeStripe({
      subscriptionsRetrieve: vi.fn().mockResolvedValue({ default_payment_method: null }),
      paymentMethodsList: vi.fn().mockResolvedValue({ data: [] }),
    });

    await expect(
      chargeOverage(stripe, { customerId: 'cus_1', subscriptionId: 'sub_1', amountCents: 500 })
    ).rejects.toThrow(/Aucun moyen de paiement/);
  });
});

describe('createCheckoutSession', () => {
  it('reuses an existing Stripe customer when one is already on file', async () => {
    const checkoutSessionsCreate = vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout/cs_1' });
    const stripe = fakeStripe({ checkoutSessionsCreate });

    await createCheckoutSession(stripe, {
      priceId: 'price_solo',
      organizationId: 'org_1',
      customerId: 'cus_existing',
      customerEmail: 'ignored@example.com',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(checkoutSessionsCreate).toHaveBeenCalledWith({
      mode: 'subscription',
      line_items: [{ price: 'price_solo', quantity: 1 }],
      client_reference_id: 'org_1',
      success_url: 'https://app/success',
      cancel_url: 'https://app/cancel',
      customer: 'cus_existing',
    });
  });

  it('prefills the email when there is no existing customer', async () => {
    const checkoutSessionsCreate = vi.fn().mockResolvedValue({ id: 'cs_2', url: 'https://checkout/cs_2' });
    const stripe = fakeStripe({ checkoutSessionsCreate });

    await createCheckoutSession(stripe, {
      priceId: 'price_pme',
      organizationId: 'org_2',
      customerId: null,
      customerEmail: 'new@example.com',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer_email: 'new@example.com' })
    );
    expect(checkoutSessionsCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ customer: expect.anything() })
    );
  });

  it('omits both customer fields when neither is available', async () => {
    const checkoutSessionsCreate = vi.fn().mockResolvedValue({ id: 'cs_3', url: 'https://checkout/cs_3' });
    const stripe = fakeStripe({ checkoutSessionsCreate });

    await createCheckoutSession(stripe, {
      priceId: 'price_pme',
      organizationId: 'org_3',
      customerId: null,
      customerEmail: null,
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    });

    const call = checkoutSessionsCreate.mock.calls[0][0];
    expect(call).not.toHaveProperty('customer');
    expect(call).not.toHaveProperty('customer_email');
  });
});
