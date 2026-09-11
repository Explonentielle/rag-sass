// Tests pour lib/supabaseResult.ts — le helper qui logue une erreur
// Supabase silencieuse au lieu de la laisser disparaître (roadmap.md
// item 38 follow-up).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logQueryError } from './supabaseResult';

// Mock du logger, comme dans rateLimit.test.ts / crypto.test.ts — pour ne
// pas écrire de vrais fichiers dans ./logs en lançant les tests. `vi.fn()`
// crée une fonction factice : on peut ensuite vérifier si/comment elle a
// été appelée avec `expect(logErrorMock).toHaveBeenCalledWith(...)`.
const logErrorMock = vi.fn();
vi.mock('@/lib/logger', () => ({ logError: (...args: unknown[]) => logErrorMock(...args) }));

beforeEach(() => {
  logErrorMock.mockClear(); // vide l'historique d'appels entre chaque test
});

describe('logQueryError', () => {
  it('returns the data unchanged when there is no error', () => {
    const data = [{ id: '1' }];
    const result = logQueryError('event.name', { orgId: 'org-1' }, data, null);
    expect(result).toBe(data);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('logs the error and still returns the data (or null) when there is one', () => {
    const error = { message: 'RLS policy violation' };
    const result = logQueryError('documents_page.documents_failed', { orgId: 'org-1' }, null, error);

    expect(result).toBeNull();
    // `toHaveBeenCalledWith(...)` vérifie les arguments exacts du dernier
    // appel — ici, l'événement, le contexte fourni, et le message
    // d'erreur ajouté dedans.
    expect(logErrorMock).toHaveBeenCalledWith('documents_page.documents_failed', {
      orgId: 'org-1',
      error: 'RLS policy violation',
    });
  });

  it('logs even when data happens to be non-null alongside an error (defensive)', () => {
    // Cas normalement impossible avec la vraie forme de réponse Supabase
    // (data et error ne sont jamais tous les deux non-null en pratique),
    // mais le helper doit rester correct même si on lui passe ça : la
    // présence d'une erreur prime toujours, elle doit être loguée.
    const error = { message: 'timeout' };
    logQueryError('event.name', {}, [{ id: '1' }], error);
    expect(logErrorMock).toHaveBeenCalledOnce();
  });
});
