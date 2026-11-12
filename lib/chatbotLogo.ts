import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logError } from '@/lib/logger';

// Logos du widget (docs/roadmap.md item 60). Bucket public en lecture (le logo
// s'affiche sur le site du client, sans session) ; seules les routes API y
// écrivent, avec le client service-role, après vérification de l'organisation.
export const CHATBOT_LOGOS_BUCKET = 'chatbot-logos';

/** URL publique d'un logo, sans appel réseau. */
export function getLogoPublicUrl(client: SupabaseClient<Database>, path: string | null): string | null {
  if (!path) return null;
  return client.storage.from(CHATBOT_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Supprime des logos ; un échec est journalisé, jamais bloquant (un logo orphelin est inoffensif). */
export async function removeChatbotLogos(
  admin: SupabaseClient<Database>,
  paths: (string | null)[]
): Promise<void> {
  const toRemove = paths.filter((p): p is string => !!p);
  if (toRemove.length === 0) return;
  const { error } = await admin.storage.from(CHATBOT_LOGOS_BUCKET).remove(toRemove);
  if (error) {
    logError('chatbot_logo.remove_failed', { count: toRemove.length, error: error.message });
  }
}
