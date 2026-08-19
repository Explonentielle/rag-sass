'use client';

import { useState, useRef, useEffect } from 'react';

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

export default function ChatWidget({ chatbotId }: { chatbotId: string }) {
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
      const res = await fetch('/api/chat', {
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
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400">Pose une question sur les documents de ce chatbot.</p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content || (loading && i === messages.length - 1 ? '...' : '')}</p>

              {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}

              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-gray-300/50 pt-1 text-xs text-gray-500">
                  Sources : {m.sources.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question..."
          disabled={loading}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
