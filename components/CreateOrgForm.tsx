'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, Input } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

export default function CreateOrgForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.rpc('create_organization', { org_name: orgName });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="p-8">
        <h1 className="text-lg font-semibold text-slate-900">Bienvenue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Donnez un nom à votre organisation pour commencer.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            type="text"
            required
            placeholder="Nom de l'entreprise"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Création...' : 'Créer mon organisation'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
