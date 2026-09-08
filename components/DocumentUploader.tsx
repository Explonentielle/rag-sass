'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // matches the upload route's maxDuration

export default function DocumentUploader({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ingestion runs in the background (see app/api/documents/upload/route.ts)
  // — poll the document's status instead of waiting on one long request.
  async function pollUntilDone(documentId: string, deadline: number) {
    const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    const status = body?.document?.status;

    if (status === 'indexed') {
      router.refresh();
      return;
    }
    if (status === 'error') {
      setError(body.document.error_message || "Échec de l'indexation.");
      router.refresh();
      return;
    }
    if (Date.now() > deadline) {
      setError('Le traitement prend plus de temps que prévu, vérifiez le statut plus tard.');
      router.refresh();
      return;
    }
    setTimeout(() => pollUntilDone(documentId, deadline), POLL_INTERVAL_MS);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('chatbotId', chatbotId);
    formData.append('file', file);

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });

    if (inputRef.current) inputRef.current.value = '';

    if (!res.ok) {
      setUploading(false);
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Échec de l'upload.");
      return;
    }

    const body = await res.json();
    router.refresh();
    setUploading(false);

    if (body.document?.id) {
      pollUntilDone(body.document.id, Date.now() + POLL_TIMEOUT_MS);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Traitement en cours...' : '+ Ajouter un document'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <p className="text-xs text-slate-400">.pdf, .docx, .txt, .md, .csv, .xlsx, .xls</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
