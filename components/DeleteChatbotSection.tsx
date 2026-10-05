'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, Input } from '@/components/ui/Card';

export default function DeleteChatbotSection({
  chatbotId,
  chatbotName,
}: {
  chatbotId: string;
  chatbotName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText === chatbotName;

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, { method: 'DELETE' });

    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la suppression.');
      return;
    }

    router.push('/dashboard/chatbots');
    router.refresh();
  }

  if (!open) {
    return (
      <Card className="border-red-200 p-6">
        <p className="text-sm font-medium text-slate-900">Supprimer ce chatbot</p>
        <p className="mt-1 text-sm text-slate-500">
          Supprime définitivement {chatbotName}, ses documents et toutes ses conversations.
          Aucune récupération possible.
        </p>
        <Button type="button" variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          Supprimer le chatbot
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 p-6">
      <p className="text-sm font-medium text-slate-900">Confirmer la suppression</p>
      <p className="mt-1 text-sm text-slate-500">
        Cette action est irréversible. Tapez <span className="font-mono font-semibold">{chatbotName}</span>{' '}
        pour confirmer.
      </p>
      <div className="mt-3 max-w-xs">
        <Input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={chatbotName}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!canConfirm || deleting}
          onClick={handleDelete}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {deleting ? 'Suppression...' : 'Supprimer définitivement'}
        </button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setConfirmText('');
            setError(null);
          }}
        >
          Annuler
        </Button>
      </div>
    </Card>
  );
}
