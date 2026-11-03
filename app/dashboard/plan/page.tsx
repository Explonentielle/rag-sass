import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import SubscribeButton from '@/components/SubscribeButton';
import ManageBillingButton from '@/components/ManageBillingButton';
import { Card, Badge } from '@/components/ui/Card';
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICE_LABELS } from '@/lib/plans';
import { logQueryError } from '@/lib/supabaseResult';
import type { OrgPlan } from '@/types/database';

const PLAN_ORDER: OrgPlan[] = ['free', 'solo', 'pme', 'metier'];

function PlanAction({
  plan,
  isCurrent,
  organizationId,
  hasStripeSubscription,
}: {
  plan: OrgPlan;
  isCurrent: boolean;
  organizationId: string;
  hasStripeSubscription: boolean;
}) {
  if (plan === 'free') {
    return <p className="text-xs text-slate-400">Inclus par défaut, aucune carte requise.</p>;
  }
  if (plan === 'metier') {
    return <p className="text-xs text-slate-400">Contactez-nous pour en discuter.</p>;
  }
  if (isCurrent) {
    return <p className="text-xs text-slate-400">Votre palier actuel.</p>;
  }
  if (hasStripeSubscription) {
    return <p className="text-xs text-slate-400">Changez via "Gérer mon abonnement" ci-dessous.</p>;
  }
  // plan is narrowed to 'solo' | 'pme' here (the two branches above ruled
  // out 'free'/'metier') — SubscribeButton only handles those two.
  return (
    <SubscribeButton
      organizationId={organizationId}
      plan={plan}
      label={`Souscrire — ${PLAN_PRICE_LABELS[plan]}`}
    />
  );
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const { data: billingData, error: billingError } = await supabase
    .from('organizations')
    .select('stripe_subscription_id')
    .eq('id', org.id)
    .single();
  const billing = logQueryError(
    'plan_page.billing_failed',
    { orgId: org.id },
    billingData,
    billingError
  );
  const hasStripeSubscription = Boolean(billing?.stripe_subscription_id);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mon plan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Le changement de palier est pris en compte immédiatement.
        </p>
      </div>

      {searchParams.checkout === 'success' && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Abonnement activé. Ça peut prendre quelques secondes pour apparaître ci-dessous.
        </div>
      )}
      {searchParams.checkout === 'cancelled' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Paiement annulé, aucun changement n'a été fait.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((p) => {
          const limit = PLAN_LIMITS[p];
          const isCurrent = org.plan === p;
          return (
            <Card
              key={p}
              className={`flex flex-col gap-3 p-5 ${isCurrent ? 'ring-1 ring-brand-500' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{PLAN_LABELS[p]}</h2>
                {isCurrent && <Badge tone="green">Actuel</Badge>}
              </div>
              <p className="text-sm text-slate-500">
                {limit === null ? 'Sur devis' : `${limit} messages / mois`}
              </p>
              <div className="mt-auto pt-1">
                <PlanAction
                  plan={p}
                  isCurrent={isCurrent}
                  organizationId={org.id}
                  hasStripeSubscription={hasStripeSubscription}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {hasStripeSubscription && (
        <div className="flex flex-wrap items-center gap-3">
          <ManageBillingButton organizationId={org.id} />
          <p className="text-xs text-slate-400">
            Changez de palier, votre moyen de paiement ou annulez depuis ce portail Stripe
            sécurisé.
          </p>
        </div>
      )}
    </div>
  );
}
