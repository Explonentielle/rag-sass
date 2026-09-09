'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Card';

interface AdminConversationSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  identity: { type: 'user'; userId: string } | { type: 'visitor'; visitorId: string };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConversationsPanel({
  chatbotId,
  initialConversations,
}: {
  chatbotId: string;
  initialConversations: AdminConversationSummary[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const identityValue = c.identity.type === 'user' ? c.identity.userId : c.identity.visitorId;
      return (c.title ?? '').toLowerCase().includes(q) || identityValue.toLowerCase().includes(q);
    });
  }, [conversations, query]);

  async function handleDelete(id: string) {
    if (!confirm('Supprimer définitivement cette conversation et tous ses messages ?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/chatbots/${chatbotId}/conversations?conversationId=${id}`, {
      method: 'DELETE',
    }).catch(() => null);
    setDeletingId(null);
    if (res?.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  if (conversations.length === 0) {
    return (
      <Card className="px-5 py-10 text-center text-sm text-slate-400">
        Aucune conversation pour l'instant.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par titre ou identifiant visiteur/utilisateur..."
      />
      <Card className="divide-y divide-slate-100">
        {filtered.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {c.title ?? <span className="italic text-slate-400">Sans message</span>}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDate(c.updatedAt)} ·{' '}
                {c.identity.type === 'user' ? (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">Équipe</span>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    Visiteur {c.identity.visitorId.slice(0, 8)}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              disabled={deletingId === c.id}
              className="flex-shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
            >
              {deletingId === c.id ? '...' : 'Supprimer'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Aucune conversation ne correspond à cette recherche.
          </div>
        )}
      </Card>
    </div>
  );
}
