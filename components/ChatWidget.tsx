'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Card';
import { resolveLoadingMessages } from '@/lib/loadingMessages';

// How long each message stays on screen before rotating to the next
// (docs/roadmap.md item 47) — short enough that even a fast answer shows
// at least two, long enough to actually be readable.
const LOADING_MESSAGE_INTERVAL_MS = 1600;

// Chat responses come back as Markdown (the LLM formats naturally with
// **bold**, lists, headers) — render it instead of showing raw syntax.
// Only used for assistant bubbles; user messages render as plain text.
const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-1 mt-2 font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1 mt-2 font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 font-semibold first:mt-0">{children}</h3>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-700 underline">
      {children}
    </a>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[] | null;
  error?: string;
  truncated?: boolean;
}

interface ConversationSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
}

const TITLE_MAX_CHARS = 42;

function conversationTitle(c: ConversationSummary): string {
  if (!c.title) return 'Nouvelle conversation';
  return c.title.length > TITLE_MAX_CHARS ? `${c.title.slice(0, TITLE_MAX_CHARS)}…` : c.title;
}

function conversationDate(c: ConversationSummary): string {
  return new Date(c.updatedAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Custom dropdown — a native <select>'s popup can't be styled to match the
 * rest of the UI (it renders with OS chrome). */
function ConversationSwitcher({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  disabled,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        <span className="truncate">{active ? conversationTitle(active) : 'Nouvelle conversation'}</span>
        <svg
          className={`h-3 w-3 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            + Nouvelle conversation
          </button>
          {conversations.length > 0 && <div className="my-1 border-t border-slate-100" />}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex w-full items-center gap-1 px-1.5 py-1 text-left text-sm hover:bg-slate-50 ${
                c.id === activeId ? 'bg-slate-50' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                className={`min-w-0 flex-1 rounded px-1.5 py-1 text-left ${
                  c.id === activeId ? 'font-medium text-slate-900' : 'text-slate-600'
                }`}
              >
                <div className="truncate">{conversationTitle(c)}</div>
                <div className="text-xs text-slate-400">{conversationDate(c)}</div>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                title="Supprimer cette conversation"
                className="flex-shrink-0 rounded p-1.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path
                    fillRule="evenodd"
                    d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const VISITOR_ID_KEY = 'corpus-visitor-id';

// Anonymous identity for the public widget/embed — there's no Supabase
// session to key conversation history on. Stored per-origin, so an iframe
// embed keeps its own id scoped to wherever it's mounted (fine: it only
// needs to survive a reload of that same page, not follow the visitor
// across sites). Falls back to a fresh, unpersisted id if storage is
// unavailable (private browsing, storage blocked) — history just won't
// survive a reload in that case, same as before this feature existed.
function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

function parseSseChunk(chunk: string): { event: string; data: any }[] {
  return chunk
    .split('\n\n')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const eventLine = block.split('\n').find((l) => l.startsWith('event: '));
      const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
      const event = eventLine?.slice('event: '.length) ?? 'message';
      const data = dataLine ? JSON.parse(dataLine.slice('data: '.length)) : {};
      return { event, data };
    });
}

export default function ChatWidget({
  chatbotId,
  apiEndpoint = '/api/chat',
  placeholder = 'Posez une question sur les documents de ce chatbot.',
  className = 'rounded-xl border border-slate-200 shadow-card',
  accentColor,
  loadingMessages,
}: {
  chatbotId: string;
  apiEndpoint?: string;
  placeholder?: string;
  className?: string;
  // Pseudo white-label for embeds (docs/integration.md's
  // data-primary-color) — applied to the visitor's message bubbles and
  // the send button, same inline-style-override pattern as
  // EmbedBubbleWidget's bubble button. Already validated as a real hex
  // color by the caller (app/embed/[chatbotId]/page.tsx); not re-validated
  // here.
  accentColor?: string;
  // Custom rotation shown while an answer streams in (docs/roadmap.md item
  // 47) — falls back to lib/loadingMessages.ts's defaults when omitted or
  // empty, same resolution the caller already applied server-side, applied
  // again here defensively in case a caller passes the raw DB column.
  loadingMessages?: string[];
}) {
  const isPublic = apiEndpoint === '/api/public-chat';
  const effectiveLoadingMessages = resolveLoadingMessages(loadingMessages);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Read from localStorage in an effect, not a useState initializer — that
  // initializer also runs during server-side rendering, where localStorage
  // doesn't exist.
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPublic) setVisitorId(getOrCreateVisitorId());
  }, [isPublic]);

  // Rotates the loading message while an answer streams in (item 47) —
  // starts fresh at index 0 each time loading begins, stops (clearInterval
  // via the cleanup function) as soon as it ends, whichever triggers first.
  useEffect(() => {
    if (!loading) return;
    setLoadingMessageIndex(0);
    const interval = setInterval(() => {
      setLoadingMessageIndex((i) => (i + 1) % effectiveLoadingMessages.length);
    }, LOADING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, effectiveLoadingMessages.length]);

  function historyUrl(conversationId?: string) {
    const params = new URLSearchParams({ chatbotId });
    if (isPublic) params.set('visitorId', visitorId!);
    if (conversationId) params.set('conversationId', conversationId);
    return `${apiEndpoint}?${params.toString()}`;
  }

  async function loadConversation(conversationId: string) {
    const res = await fetch(historyUrl(conversationId)).catch(() => null);
    if (!res?.ok) return;
    const body = await res.json().catch(() => null);
    if (Array.isArray(body?.messages)) {
      setActiveConversationId(conversationId);
      setMessages(body.messages);
    }
  }

  // On mount: list saved conversations for the switcher, and open the most
  // recent one (if any) so a reload doesn't lose it — see
  // supabase/migrations/0004_conversations.sql and 0005 (multiple
  // conversations per chatbot). Public mode waits for visitorId first.
  useEffect(() => {
    if (isPublic && !visitorId) return;
    let cancelled = false;

    async function loadConversationList() {
      const res = await fetch(historyUrl()).catch(() => null);
      if (!res?.ok || cancelled) return;
      const body = await res.json().catch(() => null);
      const list: ConversationSummary[] = Array.isArray(body?.conversations) ? body.conversations : [];
      if (cancelled) return;
      setConversations(list);
      if (list.length > 0) await loadConversation(list[0].id);
    }

    loadConversationList();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic, visitorId, chatbotId]);

  // Scroll only when a new message is *added* (user question + empty
  // assistant placeholder), not on every streamed token — otherwise the
  // view stays pinned to the bottom while a long answer streams in, and
  // you land on the end of it instead of the start once it's done.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  function handleReset() {
    if (loading) return;
    // No delete — the previous conversation stays in `conversations` and
    // stays reachable from the switcher. The next message creates a fresh
    // one server-side (no conversationId sent).
    setActiveConversationId(null);
    setMessages([]);
  }

  function handleSelectConversation(id: string) {
    if (loading || id === activeConversationId) return;
    loadConversation(id);
  }

  async function handleDeleteConversation(id: string) {
    if (loading) return;
    if (!confirm('Supprimer cette conversation ? Cette action est irréversible.')) return;

    const res = await fetch(historyUrl(id), { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) return;

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeConversationId) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading || (isPublic && !visitorId)) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const payload = { chatbotId, question, conversationId: activeConversationId ?? undefined };
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPublic ? { ...payload, visitorId } : payload),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => 'Erreur inconnue.');
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: '', error: text };
          return next;
        });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const events = parseSseChunk(part + '\n\n');
          for (const { event, data } of events) {
            if (event === 'conversation') {
              setActiveConversationId((prev) => {
                if (prev === data.conversationId) return prev;
                // First message of a brand new conversation — add it to the
                // switcher immediately rather than waiting for a refetch.
                setConversations((prevList) => [
                  {
                    id: data.conversationId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    title: prevList.find((c) => c.id === data.conversationId)?.title ?? question,
                  },
                  ...prevList.filter((c) => c.id !== data.conversationId),
                ]);
                return data.conversationId;
              });
            } else if (event === 'sources') {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], sources: data.sources };
                return next;
              });
            } else if (event === 'token') {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, content: last.content + data.text };
                return next;
              });
            } else if (event === 'error') {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], error: data.message };
                return next;
              });
            } else if (event === 'truncated') {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], truncated: true };
                return next;
              });
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex flex-1 flex-col overflow-hidden bg-white ${className}`}>
      {(conversations.length > 0 || messages.length > 0) && (
        <div className="border-b border-slate-200 px-2 py-1.5">
          <ConversationSwitcher
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleReset}
            onDelete={handleDeleteConversation}
            disabled={loading}
          />
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">{placeholder}</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              style={m.role === 'user' && accentColor ? { backgroundColor: accentColor } : undefined}
              className={`max-w-[80%] break-words rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? `text-white ${accentColor ? '' : 'bg-brand-800'}`
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {m.role === 'assistant' ? (
                m.content ? (
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{m.content}</ReactMarkdown>
                ) : (
                  loading &&
                  i === messages.length - 1 && (
                    <p className="animate-pulse text-slate-500">
                      {effectiveLoadingMessages[loadingMessageIndex]}
                    </p>
                  )
                )
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}

              {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}

              {m.truncated && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠ Réponse tronquée (limite de longueur atteinte) — reformulez pour une réponse
                  plus courte si besoin.
                </p>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-slate-300/60 pt-1.5 text-xs text-slate-500">
                  Sources : {m.sources.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-4">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question..."
          disabled={loading}
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        >
          Envoyer
        </Button>
      </form>
    </div>
  );
}
