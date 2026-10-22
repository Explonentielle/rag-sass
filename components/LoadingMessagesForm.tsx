'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Card';
import { DEFAULT_LOADING_MESSAGES } from '@/lib/loadingMessages';

export default function LoadingMessagesForm({
  chatbotId,
  initialValue,
  initialShowSteps,
}: {
  chatbotId: string;
  initialValue: string[] | null;
  initialShowSteps: boolean;
}) {
  const router = useRouter();
  const isCustom = !!initialValue && initialValue.length > 0;
  const [showSteps, setShowSteps] = useState(initialShowSteps);
  const [modeSaving, setModeSaving] = useState(false);

  async function saveMode(next: boolean) {
    if (next === showSteps) return;
    setModeSaving(true);
    setError(null);
    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showLoadingSteps: next }),
    });
    setModeSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    setShowSteps(next);
    router.refresh();
  }
  const [text, setText] = useState((initialValue ?? DEFAULT_LOADING_MESSAGES).join('\n'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function markDirty() {
    setSaved(false);
    setError(null);
  }

  async function save(loadingMessages: string[] | null) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loadingMessages }),
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

  function handleSave() {
    const messages = text
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean);
    save(messages.length > 0 ? messages : null);
  }

  function handleReset() {
    setText(DEFAULT_LOADING_MESSAGES.join('\n'));
    save(null);
  }

  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-4">
      <Label>Pendant que le chatbot prépare sa réponse</Label>
      <div className="space-y-1.5 pb-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={`loading-mode-${chatbotId}`}
            checked={!showSteps}
            disabled={modeSaving}
            onChange={() => saveMode(false)}
            className="mt-0.5 h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
          />
          <span>
            <span className="block font-medium text-slate-900">Messages personnalisés</span>
            <span className="block text-xs text-slate-500">Les messages ci-dessous défilent en boucle.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={`loading-mode-${chatbotId}`}
            checked={showSteps}
            disabled={modeSaving}
            onChange={() => saveMode(true)}
            className="mt-0.5 h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
          />
          <span>
            <span className="block font-medium text-slate-900">Étapes réelles</span>
            <span className="block text-xs text-slate-500">
              Affiche ce que fait le chatbot, avec le sujet de la question (« Je cherche "isolation maison"
              dans nos informations… », puis « Je rédige la réponse… »). Les messages ci-dessous restent
              affichés au tout début, avant la première étape.
            </span>
          </span>
        </label>
      </div>
      <Label>Messages affichés pendant la génération de la réponse (un par ligne)</Label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          markDirty();
        }}
        rows={4}
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <p className="text-xs text-slate-400">
        Défilent en boucle tant que la réponse n'est pas prête.{' '}
        {isCustom ? 'Personnalisés pour ce chatbot.' : "Valeurs par défaut de Corpus.ai."}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || saved} size="sm">
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
        </Button>
        {isCustom && (
          <Button variant="secondary" size="sm" onClick={handleReset} disabled={saving}>
            Revenir aux valeurs par défaut
          </Button>
        )}
      </div>
    </div>
  );
}
