// Tests pour lib/retentionPurge.ts — la purge Storage-aware qui a remplacé
// l'ancien job pg_cron SQL-only (migration 0018, docs/roadmap.md item 48).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));

const removeConversationFilesMock = vi.fn();
vi.mock('@/lib/conversationFiles', () => ({
  removeConversationFiles: (...args: unknown[]) => removeConversationFilesMock(...args),
}));

const { purgeExpiredConversations } = await import('./retentionPurge');

// Fausse chaîne Supabase : `.from('conversations').select('id').lt(...)`
// pour trouver les conversations expirées, puis `.delete().in('id', ...)`
// pour les supprimer — les deux appellent `.from('conversations')`, donc
// l'objet renvoyé doit offrir les deux chemins.
function fakeSupabase(selectResult: { data: unknown; error: unknown }, deleteError: unknown = null) {
  const deleteCalls: string[][] = [];
  const client = {
    from: () => ({
      select: () => ({ lt: async () => selectResult }),
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          deleteCalls.push(ids);
          return { error: deleteError };
        },
      }),
    }),
  };
  return { client: client as any, deleteCalls };
}

beforeEach(() => {
  removeConversationFilesMock.mockReset();
});

describe('purgeExpiredConversations', () => {
  it('does nothing and skips Storage cleanup when nothing is expired', async () => {
    const { client, deleteCalls } = fakeSupabase({ data: [], error: null });

    const result = await purgeExpiredConversations(client);

    expect(result).toEqual({ purged: 0 });
    expect(removeConversationFilesMock).not.toHaveBeenCalled();
    expect(deleteCalls).toHaveLength(0);
  });

  it('cleans Storage BEFORE deleting the conversations, for all expired ids', async () => {
    removeConversationFilesMock.mockResolvedValueOnce(undefined);
    const { client, deleteCalls } = fakeSupabase({
      data: [{ id: 'conv-1' }, { id: 'conv-2' }],
      error: null,
    });

    const callOrder: string[] = [];
    removeConversationFilesMock.mockImplementationOnce(async () => {
      callOrder.push('remove-files');
    });

    const result = await purgeExpiredConversations(client);

    expect(result).toEqual({ purged: 2 });
    expect(removeConversationFilesMock).toHaveBeenCalledWith(client, {
      conversationIds: ['conv-1', 'conv-2'],
    });
    expect(deleteCalls[0]).toEqual(['conv-1', 'conv-2']);
  });

  it('throws if the expired-conversations query fails, without touching Storage', async () => {
    const { client } = fakeSupabase({ data: null, error: { message: 'boom' } });

    await expect(purgeExpiredConversations(client)).rejects.toThrow('Échec de la requête de purge');
    expect(removeConversationFilesMock).not.toHaveBeenCalled();
  });

  it('throws if the delete fails (Storage was already cleaned up by then)', async () => {
    removeConversationFilesMock.mockResolvedValueOnce(undefined);
    const { client } = fakeSupabase({ data: [{ id: 'conv-1' }], error: null }, { message: 'db down' });

    await expect(purgeExpiredConversations(client)).rejects.toThrow('Échec de la suppression');
    expect(removeConversationFilesMock).toHaveBeenCalledTimes(1);
  });
});
