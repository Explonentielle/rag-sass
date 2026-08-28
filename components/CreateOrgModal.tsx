'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';

export default function CreateOrgModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('create_organization', {
      org_name: orgName,
    });

    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }

    // Switch straight to the newly created organization.
    await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: data.id }),
    });

    setLoading(false);
    onClose();
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-slate-900">Nouvelle organisation</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Nom de l'organisation</Label>
            <Input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
