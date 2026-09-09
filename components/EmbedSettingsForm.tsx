'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, Label } from '@/components/ui/Card';

export default function EmbedSettingsForm({
  chatbotId,
  initialIsPublic,
  initialAllowedOrigins,
}: {
  chatbotId: string;
  initialIsPublic: boolean;
  initialAllowedOrigins: string[];
}) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [originsText, setOriginsText] = useState(initialAllowedOrigins.join('\n'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function markDirty() {
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const allowedOrigins = originsText
      .split(/[\n,]/)
      .map((o) => o.trim())
      .filter(Boolean);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic, allowedOrigins }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="space-y-4 p-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => {
            setIsPublic(e.target.checked);
            markDirty();
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">
            Accessible via le widget public et l'embed
          </span>
          <span className="block text-xs text-slate-500">
            Désactiver bloque immédiatement <code className="rounded bg-slate-100 px-1">/api/public-chat</code>{' '}
            et <code className="rounded bg-slate-100 px-1">/embed/{chatbotId}</code> pour ce chatbot, quel que
            soit le site appelant.
          </span>
        </span>
      </label>

      <div className="space-y-1.5 border-t border-slate-100 pt-4">
        <Label>Domaines autorisés à embarquer ce chatbot (un par ligne)</Label>
        <textarea
          value={originsText}
          onChange={(e) => {
            setOriginsText(e.target.value);
            markDirty();
          }}
          placeholder="https://exemple.com&#10;https://www.exemple.com"
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-xs text-slate-400">
          Vide = aucune restriction (n'importe quel site peut embarquer ce chatbot, comportement
          actuel). Un domaine par ligne, ex. <code className="rounded bg-slate-100 px-1">https://client.com</code>.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleSave} disabled={saving || saved} size="sm">
        {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
      </Button>
    </Card>
  );
}
