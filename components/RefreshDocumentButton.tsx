'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

// Re-reads one web page now (docs/roadmap.md item 61) and says what happened:
// the page is cheap to check but re-indexing can take a while, so the button
// stays busy until the server answers.
export default function RefreshDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function handleClick() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/documents/${documentId}/refresh`, { method: 'POST' }).catch(() => null);
    setBusy(false);

    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setMessage({ text: body?.error || "L'actualisation a échoué.", tone: 'error' });
    } else {
      setMessage({
        text: body.outcome === 'updated' ? 'Page mise à jour.' : 'Déjà à jour.',
        tone: 'ok',
      });
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      {message && (
        <span className={`text-xs ${message.tone === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
      <Button variant="secondary" size="sm" onClick={handleClick} disabled={busy}>
        {busy ? 'Actualisation...' : 'Actualiser'}
      </Button>
    </span>
  );
}
