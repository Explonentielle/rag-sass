'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Supprimer ce template ? Les chatbots qui l\'utilisent déjà ne sont pas affectés.')) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
    >
      Supprimer
    </button>
  );
}
