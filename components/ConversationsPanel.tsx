'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Card';

interface AdminConversationSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  identity: { type: 'user'; userId: string } | { type: 'visitor'; visitorId: string };
  files: { id: string; filename: string }[];
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  sources: string[] | null;
  attachment?: { id: string; filename: string } | null;
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

/** Inline accordion detail for one row — fetched lazily on first expand,
 * then cached in the parent's `detailsById` so collapsing/re-expanding
 * doesn't refetch. */
function ConversationDetail({ chatbotId, conversationId }: { chatbotId: string; conversationId: string }) {
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(
        `/api/chatbots/${chatbotId}/conversations?conversationId=${conversationId}`
      ).catch(() => null);
      if (cancelled) return;
      if (!res?.ok) {
        setError("Impossible de charger cette conversation.");
        return;
      }
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      setMessages(Array.isArray(body?.messages) ? body.messages : []);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [chatbotId, conversationId]);

  if (error) return <p className="px-5 py-3 text-xs text-red-600">{error}</p>;
  if (!messages) return <p className="px-5 py-3 text-xs text-slate-400">Chargement...</p>;
  if (messages.length === 0) {
    return <p className="px-5 py-3 text-xs text-slate-400">Aucun message.</p>;
  }

  return (
    <div className="space-y-3 bg-slate-50 px-5 py-4">
      {messages.map((m, i) => (
        <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
          <div
            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-xs leading-relaxed ${
              m.role === 'user' ? 'bg-brand-800 text-white' : 'bg-white text-slate-900'
            }`}
          >
            {m.attachment ? `📎 ${m.attachment.filename}` : m.content}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-1.5 border-t border-slate-300/60 pt-1 text-[11px] text-slate-500">
                Sources : {m.sources.join(', ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        {filtered.map((c) => {
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id}>
              <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="flex w-full min-w-0 items-start gap-2 text-left"
                  >
                    <svg
                      className={`mt-1 h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
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
                  </button>
                  {c.files.length > 0 && (
                    <ul className="ml-[1.375rem] mt-1.5 space-y-0.5">
                      {c.files.map((f) => (
                        <li key={f.id} className="truncate text-xs">
                          <a
                            href={`/api/chatbots/${chatbotId}/conversations/files/${f.id}`}
                            className="text-brand-700 underline hover:text-brand-800"
                          >
                            {f.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deletingId === c.id}
                  className="flex-shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === c.id ? '...' : 'Supprimer'}
                </button>
              </div>
              {isExpanded && <ConversationDetail chatbotId={chatbotId} conversationId={c.id} />}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Aucune conversation ne correspond à cette recherche.
          </div>
        )}
      </Card>
    </div>
  );
}
