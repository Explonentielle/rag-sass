import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role Supabase client. Bypasses RLS entirely — server-only, never
 * import this from a Client Component or expose its key to the browser.
 *
 * Used for the public chat widget/embed: anonymous visitors have no
 * Supabase session, so the normal RLS-scoped client can't read chatbot rows
 * for them. This client reads exactly the fields the public chat route
 * needs and nothing else.
 */
export function getAdminClient() {
  if (!client) {
    client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        // Next 14 caches server-side fetch() calls in its Data Cache by default,
        // across requests and deployments: without this, a read of a chatbot's
        // settings (the embed page's logo, name, welcome message, the public
        // access flags...) kept returning the value from the first request after
        // the owner changed it. Every read here must see the current row.
        global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
      }
    );
  }
  return client;
}
