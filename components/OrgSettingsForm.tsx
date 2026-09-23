'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Card';
import { PLAN_LABELS, PLAN_LIMITS } from '@/lib/plans';
import type { OrgPlan } from '@/types/database';

const PLAN_OPTIONS: OrgPlan[] = ['solo', 'pme', 'metier'];

export default function OrgSettingsForm({
  orgId,
  initialName,
  initialPlan,
}: {
  orgId: string;
  initialName: string;
  initialPlan: OrgPlan;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [plan, setPlan] = useState<OrgPlan>(initialPlan);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from('organizations').update({ name, plan }).eq('id', orgId);

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
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
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
          Étiquette informative, réglable librement — pas encore reliée à un vrai paiement.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={saving || saved}>
        {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
      </Button>
    </form>
  );
}
