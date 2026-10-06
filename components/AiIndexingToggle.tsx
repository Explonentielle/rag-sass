'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Card';

export default function AiIndexingToggle({
  chatbotId,
  initialValue,
  allowed,
}: {
  chatbotId: string;
  initialValue: boolean;
  // Whether the org's plan entitles it to this feature (lib/plans.ts
  // AI_INDEXING_ALLOWED_PLANS) — re-checked server-side on save regardless,
  // this only controls what the checkbox looks like.
  allowed: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(checked: boolean) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useAiIndexing: checked }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la mise à jour.');
      return;
    }
    setValue(checked);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <input
        type="checkbox"
        checked={value}
        disabled={saving || !allowed}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-50"
      />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-medium text-slate-900">
            Indexation assistée par IA
          </span>
          <Badge tone="blue">Premium</Badge>
        </span>
        <span className="block text-xs text-slate-500">
          Un modèle nettoie (en-têtes répétés, menus, bruit) et segmente le document selon ses
          frontières logiques avant indexation, au lieu d'un découpage mécanique par taille. Utile
          pour des documents mal formatés. Léger surcoût par document, repli automatique sur le
          découpage classique en cas d'échec.
        </span>
        {!allowed && (
          <span className="mt-1 block text-xs text-amber-600">
            Nécessite le plan PME ou Métier (Paramètres → Organisation).
          </span>
        )}
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </span>
    </div>
  );
}
