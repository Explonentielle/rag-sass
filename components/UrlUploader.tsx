'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Card';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// Sibling to DocumentUploader.tsx, for URL ingestion (docs/roadmap.md item
// 18, point 5) instead of a file upload — same polling pattern, separate
// component because the input shape (one URL) and request (JSON, not
// multipart) differ enough to not share much code.
export default function UrlUploader({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pollUntilDone(documentId: string, deadline: number) {
    const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    const status = body?.document?.status;

    if (status === 'indexed' || status === 'error') {
      router.refresh();
      return;
    }
    if (Date.now() > deadline) {
      router.refresh();
      return;
    }
    setTimeout(() => pollUntilDone(documentId, deadline), POLL_INTERVAL_MS);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/documents/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId, url: url.trim() }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Échec de l'ajout.");
      return;
    }

    const body = await res.json();
    setUrl('');
    router.refresh();

    if (body.document?.id) {
      pollUntilDone(body.document.id, Date.now() + POLL_TIMEOUT_MS);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://exemple.com/page"
          disabled={submitting}
          className="w-56"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting || !url.trim()}>
          {submitting ? 'Ajout...' : '+ Ajouter une URL'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
