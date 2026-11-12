import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

beforeAll(() => {
  // lib/crypto.ts reads this at call time; any valid 32-byte key works here.
  process.env.CONVERSATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

import { appendTurn } from './conversations';

function fakeClient(insertResult: { data: unknown; error: { message: string } | null }) {
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue(insertResult) });
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn((table: string) => (table === 'messages' ? { insert } : { update }));
  return { client: { from } as unknown as SupabaseClient<Database>, insert };
}

describe('appendTurn', () => {
  it("renseigne no_context sur les DEUX lignes (un insert groupé envoie null pour une clé absente d'une ligne)", async () => {
    const { client, insert } = fakeClient({
      data: [
        { id: 'u1', role: 'user' },
        { id: 'a1', role: 'assistant' },
      ],
      error: null,
    });

    await appendTurn(client, 'conv-1', { question: 'Bonjour', answer: 'Salut', sources: [], noContext: true });

    const rows = insert.mock.calls[0][0] as { role: string; no_context?: boolean }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(typeof row.no_context).toBe('boolean');
    }
    expect(rows.find((r) => r.role === 'user')?.no_context).toBe(false);
    expect(rows.find((r) => r.role === 'assistant')?.no_context).toBe(true);
  });

  it("renvoie l'id du message de la réponse", async () => {
    const { client } = fakeClient({
      data: [
        { id: 'u1', role: 'user' },
        { id: 'a1', role: 'assistant' },
      ],
      error: null,
    });
    await expect(appendTurn(client, 'conv-1', { question: 'q', answer: 'r', sources: [] })).resolves.toEqual({
      assistantMessageId: 'a1',
    });
  });

  it("lève une erreur claire si l'enregistrement échoue", async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    await expect(appendTurn(client, 'conv-1', { question: 'q', answer: 'r', sources: [] })).rejects.toThrow(
      "Impossible d'enregistrer les messages"
    );
  });
});
