'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';
import type { DocumentFormat } from '@/types/database';

// Contrairement à components/CreateContractForm.tsx (un clic, un fichier,
// pas de champ nom : un contrat = une analyse isolée), un digitaliseur
// accumule plusieurs documents au fil du temps (docs/roadmap.md item 24) :
// il lui faut un nom propre, et le format est fixé une fois pour toutes à
// la création puisqu'il oriente l'extraction de chaque document ajouté
// ensuite. Pas d'upload de fichier ici : il se fait après coup sur la page
// du digitaliseur, via components/DocumentUploader.tsx.
export default function CreateDigitizerForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DocumentFormat>('facture');
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
      body: JSON.stringify({
        organizationId,
        name,
        useCase: 'paperwork_digitizer',
        documentFormat: format,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLoading(false);
      setError(body.error || 'Erreur lors de la création.');
      return;
    }

    const { id } = await res.json();
    router.push(`/dashboard/paperasse/${id}`);
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Nouveau digitaliseur</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900">Nouveau digitaliseur</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures fournisseurs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Format des documents</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as DocumentFormat)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="facture">Facture</option>
              <option value="libre">Libre (le modèle identifie les champs lui-même)</option>
            </select>
            <p className="text-xs text-slate-400">
              Fixé à la création : détermine les champs extraits de chaque document ajouté ensuite.
            </p>
          </div>

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
