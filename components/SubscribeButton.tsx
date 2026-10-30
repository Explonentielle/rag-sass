'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export default function SubscribeButton({
  organizationId,
  plan,
  label,
}: {
  organizationId: string;
  plan: 'solo' | 'pme';
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, plan }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la création du paiement.');
      setLoading(false);
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div>
      <Button type="button" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? 'Redirection...' : label}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
