'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    <div className="mx-auto max-w-sm rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-lg font-semibold">Bienvenue</h1>
      <p className="mb-4 text-sm text-gray-600">Donne un nom à ton organisation pour commencer.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          placeholder="Nom de l'entreprise"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer mon organisation'}
        </button>
      </form>
    </div>
  );
}
