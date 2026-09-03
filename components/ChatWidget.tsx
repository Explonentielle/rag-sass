'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Card';

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
  sources?: string[];
  error?: string;
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
}: {
  chatbotId: string;
  apiEndpoint?: string;
  placeholder?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll only when a new message is *added* (user question + empty
  // assistant placeholder), not on every streamed token — otherwise the
  // view stays pinned to the bottom while a long answer streams in, and
  // you land on the end of it instead of the start once it's done.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const history = messages.map(({ role, content }) => ({ role, content }));

    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId, question, history }),
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
            if (event === 'sources') {
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
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">{placeholder}</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-brand-800 text-white' : 'bg-slate-100 text-slate-900'
              }`}
            >
              {m.role === 'assistant' ? (
                m.content ? (
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{m.content}</ReactMarkdown>
                ) : (
                  loading && i === messages.length - 1 && <p>···</p>
                )
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}

              {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}

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
        <Button type="submit" disabled={loading || !input.trim()}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
