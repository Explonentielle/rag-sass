'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Card';
import { PLAN_LABELS, PLAN_LIMITS, OVERAGE_MODE_LABELS } from '@/lib/plans';
import type { OrgPlan, OrgOverageMode } from '@/types/database';

const PLAN_OPTIONS: OrgPlan[] = ['solo', 'pme', 'metier'];
const OVERAGE_MODE_OPTIONS: OrgOverageMode[] = ['block', 'auto_bill'];

export default function OrgSettingsForm({
  orgId,
  initialName,
  initialPlan,
  initialOverageMode,
  hasStripeCustomer,
  hasStripeSubscription,
}: {
  orgId: string;
  initialName: string;
  initialPlan: OrgPlan;
  initialOverageMode: OrgOverageMode;
  // True once the org has paid at least once (stripe_customer_id set by
  // the webhook) — auto_bill needs a saved payment method to charge.
  hasStripeCustomer: boolean;
  // True once a real Stripe subscription backs this org's plan — past
  // that point the plan stops being a free self-service toggle (it used
  // to let any admin set themselves to "Métier" for free).
  hasStripeSubscription: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [plan, setPlan] = useState<OrgPlan>(initialPlan);
  const [overageMode, setOverageMode] = useState<OrgOverageMode>(initialOverageMode);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const update: { name: string; plan?: OrgPlan; overage_mode: OrgOverageMode } = {
      name,
      overage_mode: overageMode,
    };
    // Plan is locked once a real subscription exists — see the note in
    // the Plan section below.
    if (!hasStripeSubscription) update.plan = plan;

    const { error } = await supabase.from('organizations').update(update).eq('id', orgId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Nom de l'organisation</Label>
        <Input
          type="text"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Plan</Label>
        <div className="flex flex-wrap gap-2">
          {PLAN_OPTIONS.map((p) => {
            const limit = PLAN_LIMITS[p];
            return (
              <label
                key={p}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  hasStripeSubscription ? 'cursor-default opacity-60' : 'cursor-pointer'
                } ${
                  plan === p
                    ? 'border-brand-500 bg-brand-50 text-brand-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  className="sr-only"
                  checked={plan === p}
                  disabled={hasStripeSubscription}
                  onChange={() => {
                    setPlan(p);
                    setSaved(false);
                  }}
                />
                <span className="font-medium">{PLAN_LABELS[p]}</span>
                <span className="text-xs text-slate-400">
                  {limit === null ? 'sur devis' : `${limit} msg/mois`}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          {hasStripeSubscription
            ? 'Géré par votre abonnement Stripe — contactez le support pour changer de palier.'
            : 'Étiquette informative, réglable librement — pas encore reliée à un vrai paiement.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Au dépassement du quota</Label>
        <div className="flex flex-wrap gap-2">
          {OVERAGE_MODE_OPTIONS.map((m) => {
            const disabled = m === 'auto_bill' && !hasStripeCustomer;
            return (
              <label
                key={m}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                } ${
                  overageMode === m
                    ? 'border-brand-500 bg-brand-50 text-brand-900'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="overage_mode"
                  className="sr-only"
                  checked={overageMode === m}
                  disabled={disabled}
                  onChange={() => {
                    setOverageMode(m);
                    setSaved(false);
                  }}
                />
                <span className="font-medium">{OVERAGE_MODE_LABELS[m]}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          {hasStripeCustomer
            ? 'Débit automatique : facture la tranche de dépassement sur le moyen de paiement déjà enregistré.'
            : 'Débit automatique disponible une fois abonné via Stripe.'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={saving || saved}>
        {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
      </Button>
    </form>
  );
}
