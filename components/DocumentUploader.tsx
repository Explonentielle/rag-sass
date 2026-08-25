'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function DocumentUploader({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('chatbotId', chatbotId);
    formData.append('file', file);

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Échec de l'upload.");
      return;
    }

    const body = await res.json();
    if (body.document?.status === 'error') {
      setError(body.document.error_message || "Échec de l'indexation.");
    }

    router.refresh();
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
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      <p className="text-xs text-slate-400">.pdf, .docx, .txt, .md</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
