// Tests pour lib/loadingMessages.ts — résolution des messages de
// chargement personnalisés vs valeurs par défaut (roadmap item 47).

import { describe, it, expect } from 'vitest';
import { resolveLoadingMessages, DEFAULT_LOADING_MESSAGES } from './loadingMessages';

describe('resolveLoadingMessages', () => {
  it('returns the defaults when no custom messages are given', () => {
    expect(resolveLoadingMessages(undefined)).toEqual(DEFAULT_LOADING_MESSAGES);
    expect(resolveLoadingMessages(null)).toEqual(DEFAULT_LOADING_MESSAGES);
    expect(resolveLoadingMessages([])).toEqual(DEFAULT_LOADING_MESSAGES);
  });

  it('returns the custom messages, trimmed, when provided', () => {
    expect(resolveLoadingMessages(['  Un instant...  ', 'Je prépare votre réponse...'])).toEqual([
      'Un instant...',
      'Je prépare votre réponse...',
    ]);
  });

  it('falls back to defaults if every custom message is blank', () => {
    expect(resolveLoadingMessages(['   ', ''])).toEqual(DEFAULT_LOADING_MESSAGES);
  });

  it('drops only the blank entries, keeps the real ones', () => {
    expect(resolveLoadingMessages(['Un instant...', '  ', 'Presque fini...'])).toEqual([
      'Un instant...',
      'Presque fini...',
    ]);
  });
});
