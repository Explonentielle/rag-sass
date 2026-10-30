'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROMPT_TEMPLATES } from '@/lib/prompts';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';
import type { ChatbotUseCase } from '@/types/database';

interface CustomTemplate {
  id: string;
  label: string;
  template: string;
}

export default function CreateChatbotForm({
  organizationId,
  customTemplates = [],
  useCase,
}: {
  organizationId: string;
  customTemplates?: CustomTemplate[];
  // Fixe dès la création selon l'interface d'où vient le formulaire
  // (page "Chatbots" ou page "Second cerveau") — pas un choix affiché à
  // l'utilisateur, voir docs/roadmap.md item 52.
  useCase: ChatbotUseCase;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [templateKey, setTemplateKey] = useState(`default:${PROMPT_TEMPLATES[0].id}`);
  const [useDocuments, setUseDocuments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function resolveTemplateText(key: string): string {
    const [kind, id] = key.split(':');
    if (kind === 'custom') {
      return customTemplates.find((t) => t.id === id)?.template ?? PROMPT_TEMPLATES[0].template;
    }
    return PROMPT_TEMPLATES.find((t) => t.id === id)?.template ?? PROMPT_TEMPLATES[0].template;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        name,
        systemPromptTemplate: resolveTemplateText(templateKey),
        useDocuments,
        useCase,
      }),
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
    return <Button onClick={() => setOpen(true)}>+ Créer un chatbot</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">Nouveau chatbot</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Nom du chatbot</Label>
            <Input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Template de comportement</Label>
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <optgroup label="Par défaut">
                {PROMPT_TEMPLATES.map((t) => (
                  <option key={t.id} value={`default:${t.id}`}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              {customTemplates.length > 0 && (
                <optgroup label="Mes templates">
                  {customTemplates.map((t) => (
                    <option key={t.id} value={`custom:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-slate-400">Modifiable ensuite dans la page du chatbot.</p>
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={useDocuments}
              onChange={(e) => setUseDocuments(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">
                Ce chatbot se base sur des documents à uploader
              </span>
              <span className="block text-xs text-slate-400">
                Décocher si vous n'avez pas de documents — le chatbot répondra uniquement à partir
                du prompt ci-dessus (utilisez le template "Assistant simple (sans documents)" pour
                y écrire directement vos infos/FAQ).
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
