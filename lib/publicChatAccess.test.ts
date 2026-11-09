// Tests pour lib/publicChatAccess.ts getAccessibleChatbot — en particulier
// le filtre sur use_case ajouté suite à un signalement (une organisation
// 'second_cerveau'/'contract_analyzer' pouvait rester joignable via
// l'endpoint anonyme /api/public-chat si is_public valait true, par défaut
// au niveau colonne). Le reste de la logique (is_public, allowed_origins)
// était déjà en prod, retesté ici en passant pour ne pas le casser.

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getAccessibleChatbot } from './publicChatAccess';

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

function fakeAdmin(row: Record<string, unknown> | null): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(row ? { data: row, error: null } : { data: null, error: { code: 'PGRST116', message: 'not found' } }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

// No Origin/Referer header: originOk only passes when allowed_origins is
// empty (the "no restriction" default) — every fixture below uses that, so
// the origin check never masks what each test is actually about.
const request = new Request('https://example.com/api/public-chat');

const baseRow = {
  id: 'bot-1',
  organization_id: 'org-1',
  system_prompt_template: 'Tu es un assistant.',
  is_public: true,
  allowed_origins: [],
  use_documents: true,
  allow_email_tool: false,
  notification_email: null,
  allow_visitor_uploads: false,
  organizations: { plan: 'pme', overage_mode: 'block' },
};

describe('getAccessibleChatbot', () => {
  it('allows a public site_widget chatbot', async () => {
    const result = await getAccessibleChatbot(
      fakeAdmin({ ...baseRow, use_case: 'site_widget' }),
      'bot-1',
      request
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a second_cerveau chatbot even when is_public is true', async () => {
    const result = await getAccessibleChatbot(
      fakeAdmin({ ...baseRow, use_case: 'second_cerveau' }),
      'bot-1',
      request
    );
    expect(result).toEqual({ ok: false, reason: 'private' });
  });

  it('rejects a contract_analyzer chatbot even when is_public is true', async () => {
    const result = await getAccessibleChatbot(
      fakeAdmin({ ...baseRow, use_case: 'contract_analyzer' }),
      'bot-1',
      request
    );
    expect(result).toEqual({ ok: false, reason: 'private' });
  });

  it('still rejects a site_widget chatbot that is not public', async () => {
    const result = await getAccessibleChatbot(
      fakeAdmin({ ...baseRow, use_case: 'site_widget', is_public: false }),
      'bot-1',
      request
    );
    expect(result).toEqual({ ok: false, reason: 'private' });
  });

  it('returns not_found for a nonexistent chatbot', async () => {
    const result = await getAccessibleChatbot(fakeAdmin(null), 'missing', request);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});
