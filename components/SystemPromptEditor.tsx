'use client';

import { useState } from 'react';
import { PROMPT_TEMPLATES, getPromptTemplate } from '@/lib/prompts';

export default function SystemPromptEditor({
  chatbotId,
  initialValue,
}: {
  chatbotId: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(templateId: string) {
    const template = getPromptTemplate(templateId);
    if (template) {
      setValue(template.template);
      setSaved(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPromptTemplate: value }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    setSaved(true);
  }

  return (
    <div className="space-y-2 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Partir d'un template :</span>
        {PROMPT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => applyTemplate(t.id)}
            className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={10}
        className="w-full rounded border px-3 py-2 font-mono text-xs"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
