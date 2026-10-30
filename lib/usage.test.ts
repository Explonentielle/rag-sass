// Tests pour lib/usage.ts, checkQuota uniquement (docs/roadmap.md items
// 17/36) — getMonthlyMessageCount est un simple select compté, pas
// retesté ici séparément. Le client Supabase est un faux objet
// chainable + thenable (même esprit qu'un mock de requête Supabase
// classique), pas le vrai SDK.

import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { checkQuota } from './usage';

function fakeSupabaseWithCount(count: number): SupabaseClient<Database> {
  const chain = {
    eq: () => chain,
    gte: () => chain,
    then: (resolve: (v: { count: number; error: null }) => void) =>
      resolve({ count, error: null }),
  };
  return {
    from: () => ({ select: () => chain }),
  } as unknown as SupabaseClient<Database>;
}

describe('checkQuota', () => {
  it('blocks in "block" mode once the plan limit is reached', async () => {
    const supabase = fakeSupabaseWithCount(300);
    const result = await checkQuota(supabase, {
      organizationId: 'org-1',
      plan: 'solo',
      overageMode: 'block',
    });
    expect(result).toEqual({ blocked: true, messagesThisMonth: 300 });
  });

  it('does not block in "block" mode below the plan limit', async () => {
    const supabase = fakeSupabaseWithCount(299);
    const result = await checkQuota(supabase, {
      organizationId: 'org-1',
      plan: 'solo',
      overageMode: 'block',
    });
    expect(result.blocked).toBe(false);
  });

  it('never blocks in "auto_bill" mode even far above the limit', async () => {
    const supabase = fakeSupabaseWithCount(10_000);
    const result = await checkQuota(supabase, {
      organizationId: 'org-1',
      plan: 'solo',
      overageMode: 'auto_bill',
    });
    expect(result.blocked).toBe(false);
  });

  it('never blocks a "metier" org (null limit, sur devis) in "block" mode', async () => {
    const supabase = fakeSupabaseWithCount(1_000_000);
    const result = await checkQuota(supabase, {
      organizationId: 'org-1',
      plan: 'metier',
      overageMode: 'block',
    });
    expect(result.blocked).toBe(false);
  });
});
