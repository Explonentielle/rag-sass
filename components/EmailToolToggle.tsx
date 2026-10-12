'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Card';

export default function EmailToolToggle({
  chatbotId,
  initialValue,
}: {
  chatbotId: string;
  initialValue: boolean;
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
      body: JSON.stringify({ allowEmailTool: checked }),
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
        disabled={saving}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-50"
      />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-medium text-slate-900">
            Notifier par email quand un visiteur veut être recontacté
          </span>
          <Badge tone="blue">Agentique</Badge>
        </span>
        <span className="block text-xs text-slate-500">
          Le chatbot détecte quand un visiteur souhaite être recontacté et vous envoie un résumé par
          email avec ses coordonnées si elles ont été données.
        </span>
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </span>
    </div>
  );
}
