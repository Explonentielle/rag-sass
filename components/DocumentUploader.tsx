'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // matches the upload route's maxDuration

interface UploadError {
  filename: string;
  message: string;
}

export default function DocumentUploader({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Number of files whose initial upload request is still in flight — not
  // how many are still being indexed in the background (that progress
  // shows up as each row's status badge in the document table below,
  // refreshed by pollUntilDone). Used only to disable the picker and show
  // a count while a batch is being sent.
  const [pendingCount, setPendingCount] = useState(0);
  const [errors, setErrors] = useState<UploadError[]>([]);

  // Ingestion runs in the background (see app/api/documents/upload/route.ts)
  // — poll the document's status instead of waiting on one long request.
  async function pollUntilDone(documentId: string, deadline: number) {
    const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    const status = body?.document?.status;

    if (status === 'indexed' || status === 'error') {
      // The document table's status badge already reflects the outcome
      // (including the error message, for 'error') — just refresh it.
      router.refresh();
      return;
    }
    if (Date.now() > deadline) {
      router.refresh();
      return;
    }
    setTimeout(() => pollUntilDone(documentId, deadline), POLL_INTERVAL_MS);
  }

  async function uploadOne(file: File) {
    const formData = new FormData();
    formData.append('chatbotId', chatbotId);
    formData.append('file', file);

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData }).catch(
      () => null
    );

    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({}));
      setErrors((prev) => [
        ...prev,
        { filename: file.name, message: body?.error || "Échec de l'upload." },
      ]);
      return;
    }

    const body = await res.json();
    // Refresh as soon as this one file is saved (status: pending appears
    // in the table) rather than waiting for the whole batch to finish.
    router.refresh();

    if (body.document?.id) {
      pollUntilDone(body.document.id, Date.now() + POLL_TIMEOUT_MS);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    setErrors([]);
    setPendingCount(files.length);

    // Each file is independent (ingestion is already asynchronous
    // server-side, see app/api/documents/upload/route.ts) — send them all
    // at once instead of waiting for one to finish before starting the
    // next (docs/roadmap.md item 40). Per-file progress is visible in the
    // document table below as each one's status updates.
    await Promise.allSettled(
      files.map((file) => uploadOne(file).finally(() => setPendingCount((n) => n - 1)))
    );
  }

  const uploading = pendingCount > 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? `Envoi en cours (${pendingCount})...` : '+ Ajouter des documents'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
        multiple
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <p className="text-xs text-slate-400">.pdf, .docx, .txt, .md, .csv, .xlsx, .xls</p>
      {errors.map((e, i) => (
        <p key={`${e.filename}-${i}`} className="text-sm text-red-600">
          {e.filename} : {e.message}
        </p>
      ))}
    </div>
  );
}
