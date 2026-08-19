'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROMPT_TEMPLATES } from '@/lib/prompts';

export default function CreateChatbotForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(PROMPT_TEMPLATES[0].id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, name, templateId }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la création.');
      return;
    }

    setName('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        + Créer un chatbot
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <label className="text-sm font-medium">Nom du chatbot</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Template de comportement</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          {PROMPT_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">Modifiable ensuite dans la page du chatbot.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border px-4 py-2 text-sm font-medium"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
