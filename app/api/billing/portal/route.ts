import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient, createBillingPortalSession } from '@/lib/stripe';
import { logError } from '@/lib/logger';

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
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId est requis.' }, { status: 400 });
  }

  // RLS (organizations_select: is_org_member) rejects this read if the
  // signed-in user doesn't belong to this org — no extra check needed.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', organizationId)
    .single();
  if (orgError || !org?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Aucun abonnement Stripe pour cette organisation.' },
      { status: 404 }
    );
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;

  try {
    const stripe = getStripeClient();
    const session = await createBillingPortalSession(stripe, {
      customerId: org.stripe_customer_id,
      returnUrl: `${origin}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    logError('billing_portal.create_failed', {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Impossible d'ouvrir le portail de facturation." },
      { status: 500 }
    );
  }
}
