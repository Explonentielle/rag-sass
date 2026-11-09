'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

function nameFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  return withoutExtension.trim() || filename;
}

// One click, one file picker, no separate "name" field — the whole point
// of the isolated-per-contract model (docs/roadmap.md item 23) is to make
// "upload a contract, get an analysis" as close to zero-friction as
// possible. Two requests under the hood (create the chatbot, then upload
// the file), same two-step pattern as components/OnboardingTour.tsx's
// create-then-upload flow; if the upload step fails, the just-created
// chatbot is deleted rather than left behind as an empty, permanently
// stuck "contract" with no document and no way to add one.
export default function CreateContractForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;

    setSubmitting(true);
    setError(null);

    const createRes = await fetch('/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        name: nameFromFilename(file.name),
        useCase: 'contract_analyzer',
        useDocuments: true,
      }),
    }).catch(() => null);

    if (!createRes || !createRes.ok) {
      const body = await createRes?.json().catch(() => ({}));
      setSubmitting(false);
      setError(body?.error || "Échec de la création de l'analyse.");
      return;
    }

    const { id: chatbotId } = await createRes.json();

    const formData = new FormData();
    formData.append('chatbotId', chatbotId);
    formData.append('file', file);

    const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: formData }).catch(
      () => null
    );

    if (!uploadRes || !uploadRes.ok) {
      const body = await uploadRes?.json().catch(() => ({}));
      await fetch(`/api/chatbots/${chatbotId}`, { method: 'DELETE' }).catch(() => {});
      setSubmitting(false);
      setError(body?.error || "Échec de l'upload du contrat.");
      return;
    }

    router.push(`/dashboard/contrats/${chatbotId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => inputRef.current?.click()} disabled={submitting}>
        {submitting ? 'Analyse en cours...' : '+ Analyser un contrat'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        disabled={submitting}
        className="hidden"
      />
      {error && <p className="max-w-xs text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
