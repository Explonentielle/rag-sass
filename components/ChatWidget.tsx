'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Card';

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
              <p className="whitespace-pre-wrap">{m.content || (loading && i === messages.length - 1 ? '···' : '')}</p>

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
