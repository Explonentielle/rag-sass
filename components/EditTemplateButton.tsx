'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';

export default function EditTemplateButton({
  templateId,
  initialLabel,
  initialTemplate,
}: {
  templateId: string;
  initialLabel: string;
  initialTemplate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [template, setTemplate] = useState(initialTemplate);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, template }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        Modifier
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-slate-900">Modifier le template</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Nom du template</Label>
            <Input type="text" required value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Prompt</Label>
            <textarea
              required
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setLabel(initialLabel);
                setTemplate(initialTemplate);
                setError(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
