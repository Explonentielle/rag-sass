'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PROMPT_TEMPLATES, getPromptTemplate } from '@/lib/prompts';
import { Button } from '@/components/ui/Button';
import { Badge, Card, Input } from '@/components/ui/Card';

interface CustomTemplate {
  id: string;
  label: string;
  template: string;
}

export default function SystemPromptEditor({
  chatbotId,
  organizationId,
  initialValue,
  initialUseDocuments,
  customTemplates,
}: {
  chatbotId: string;
  organizationId: string;
  initialValue: string;
  initialUseDocuments: boolean;
  customTemplates: CustomTemplate[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [useDocuments, setUseDocuments] = useState(initialUseDocuments);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [templateError, setTemplateError] = useState<string | null>(null);

  const matchingTemplate = useMemo(
    () =>
      PROMPT_TEMPLATES.find((t) => t.template === value) ??
      customTemplates.find((t) => t.template === value),
    [value, customTemplates]
  );

  function applyTemplate(template: string) {
    setValue(template);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPromptTemplate: value, useDocuments }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    setSaved(true);
  }

  async function handleSaveAsTemplate(e: React.FormEvent) {
    e.preventDefault();
    setTemplateError(null);

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, label: newTemplateLabel, template: value }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setTemplateError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }

    setNewTemplateLabel('');
    setSavingAsTemplate(false);
    router.refresh();
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Partir d'un template :</span>
          {PROMPT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.template)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              {t.label}
            </button>
          ))}
          {customTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.template)}
              className="rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:border-brand-300"
            >
              {t.label}
            </button>
          ))}
        </div>
        {matchingTemplate ? (
          <Badge tone="blue">Template : {matchingTemplate.label}</Badge>
        ) : (
          <Badge tone="neutral">Personnalisé</Badge>
        )}
      </div>
      <p className="-mt-1 text-xs text-slate-400">
        Appliquer un template copie son contenu ici — modifier le template plus tard ne mettra pas
        à jour ce chatbot.
      </p>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={10}
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <label className="flex items-start gap-2.5 border-t border-slate-100 pt-3">
        <input
          type="checkbox"
          checked={useDocuments}
          onChange={(e) => {
            setUseDocuments(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
        />
        <span>
          <span className="block text-sm font-medium text-slate-900">
            Ce chatbot se base sur des documents à uploader
          </span>
          <span className="block text-xs text-slate-400">
            Décoché, il répond uniquement à partir du prompt ci-dessus (aucune recherche dans des
            documents) — utile pour un chatbot simple dont toutes les infos tiennent dans le prompt.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={saving || saved} size="sm">
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
        </Button>
        {!savingAsTemplate && (
          <Button variant="secondary" size="sm" onClick={() => setSavingAsTemplate(true)}>
            Enregistrer comme template
          </Button>
        )}
      </div>

      {savingAsTemplate && (
        <form onSubmit={handleSaveAsTemplate} className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
          <Input
            type="text"
            required
            placeholder="Nom du template"
            value={newTemplateLabel}
            onChange={(e) => setNewTemplateLabel(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" size="sm">
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSavingAsTemplate(false);
              setTemplateError(null);
            }}
          >
            Annuler
          </Button>
          {templateError && <p className="w-full text-sm text-red-600">{templateError}</p>}
        </form>
      )}
    </Card>
  );
}
