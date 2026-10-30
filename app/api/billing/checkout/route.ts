import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient, createCheckoutSession } from '@/lib/stripe';
import { logError } from '@/lib/logger';

const PRICE_ENV_BY_PLAN: Record<'solo' | 'pme', string | undefined> = {
  solo: process.env.STRIPE_PRICE_SOLO,
  pme: process.env.STRIPE_PRICE_PME,
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId: string | undefined = body?.organizationId;
  const plan: string | undefined = body?.plan;

  if (!organizationId || (plan !== 'solo' && plan !== 'pme')) {
    return NextResponse.json(
      { error: 'organizationId et plan (solo ou pme) sont requis.' },
      { status: 400 }
    );
  }

  const priceId = PRICE_ENV_BY_PLAN[plan];
  if (!priceId) {
    return NextResponse.json({ error: 'Ce palier n\'est pas encore configuré.' }, { status: 400 });
  }

  // RLS (organizations_select: is_org_member) rejects this read if the
  // signed-in user doesn't belong to this org — no extra check needed.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', organizationId)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  try {
    const stripe = getStripeClient();
    const session = await createCheckoutSession(stripe, {
      priceId,
      organizationId,
      customerId: org.stripe_customer_id,
      customerEmail: org.stripe_customer_id ? null : (user.email ?? null),
      successUrl: `${origin}/dashboard/settings?checkout=success`,
      cancelUrl: `${origin}/dashboard/settings?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error('Session Stripe créée sans URL de redirection.');
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logError('billing_checkout.create_failed', {
      organizationId,
      plan,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Impossible de créer la session de paiement.' }, { status: 500 });
  }
}
