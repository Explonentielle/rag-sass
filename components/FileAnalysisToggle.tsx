'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Card';

export default function FileAnalysisToggle({
  chatbotId,
  initialValue,
  uploadsEnabled,
  allowed,
}: {
  chatbotId: string;
  initialValue: boolean;
  /** Visitor uploads are on — without them there is nothing to read. */
  uploadsEnabled: boolean;
  // Whether the org's plan entitles it to this feature (lib/plans.ts
  // VISITOR_FILE_ANALYSIS_ALLOWED_PLANS) — re-checked server-side on save
  // regardless, this only controls what the checkbox looks like.
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
      body: JSON.stringify({ analyzeVisitorFiles: checked }),
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
        disabled={saving || !allowed || !uploadsEnabled}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-50"
      />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-medium text-slate-900">
            Le chatbot lit les fichiers envoyés par les visiteurs
          </span>
          <Badge tone="blue">Premium</Badge>
        </span>
        <span className="block text-xs text-slate-500">
          Le visiteur joint une facture, un devis ou un scan et pose sa question : le chatbot en lit le texte
          (OCR pour les scans et les images) et répond à partir du fichier. Le contenu est envoyé à OpenAI, comme
          les messages, et conservé chiffré avec la conversation. Un fichier illisible ou très long (début
          seulement) est signalé au visiteur. Chaque question de la conversation embarque le texte des fichiers,
          ce qui augmente légèrement le coût des réponses.
        </span>
        {!uploadsEnabled && (
          <span className="mt-1 block text-xs text-amber-600">
            Activez d&apos;abord l&apos;envoi de fichiers ci-dessus.
          </span>
        )}
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
