'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SOURCE_REFRESH_LABELS, isSourceRefreshFrequency } from '@/lib/sourceRefreshRules';
import type { SourceRefreshFrequency } from '@/types/database';

export default function SourceRefreshSelect({
  chatbotId,
  initialValue,
}: {
  chatbotId: string;
  initialValue: SourceRefreshFrequency;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: string) {
    if (!isSourceRefreshFrequency(next)) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceRefresh: next }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la mise à jour.');
      return;
    }
    setValue(next);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">Mise à jour automatique des pages web</span>
        <span className="block text-xs text-slate-500">
          Le chatbot relit régulièrement les pages ajoutées par adresse. Une page n&apos;est ré-indexée que si
          son contenu a changé ; en cas d&apos;échec de lecture (site indisponible), l&apos;ancien contenu est
          conservé. Les fichiers envoyés ne sont pas concernés.
        </span>
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </span>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Fréquence de mise à jour des pages web"
        className="flex-shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
      >
        {(Object.keys(SOURCE_REFRESH_LABELS) as SourceRefreshFrequency[]).map((frequency) => (
          <option key={frequency} value={frequency}>
            {SOURCE_REFRESH_LABELS[frequency]}
          </option>
        ))}
      </select>
    </div>
  );
}
