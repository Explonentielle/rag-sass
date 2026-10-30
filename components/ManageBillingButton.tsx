'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export default function ManageBillingButton({ organizationId }: { organizationId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Erreur lors de l'ouverture du portail.");
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? 'Redirection...' : 'Gérer mon abonnement'}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
