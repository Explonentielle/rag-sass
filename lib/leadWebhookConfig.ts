import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { encryptText } from '@/lib/crypto';
import { generateWebhookSecret } from '@/lib/leadWebhook';
import { assertPublicHostname, BlockedAddressError } from '@/lib/ssrfGuard';
import { LEAD_WEBHOOK_ALLOWED_PLANS } from '@/lib/plans';

// Changement de configuration du webhook « nouveau lead » (docs/roadmap.md
// item 62), isolé de la route PATCH du chatbot : droit au palier, adresse
// publique, génération du secret.

export type WebhookConfigUpdate =
  | { ok: true; update: { lead_webhook_url?: string | null; lead_webhook_secret?: string | null } }
  | { ok: false; status: number; error: string };

/**
 * `url` : undefined = inchangé, null = supprimer le webhook (et son secret),
 * sinon nouvelle adresse déjà validée par validateWebhookUrl. `regenerate`
 * génère un nouveau secret (l'ancien cesse de fonctionner immédiatement).
 * Le secret n'est généré qu'à la première configuration d'une adresse.
 */
export async function prepareWebhookUpdate(
  supabase: SupabaseClient<Database>,
  chatbotId: string,
  input: { url: string | null | undefined; regenerate: boolean }
): Promise<WebhookConfigUpdate> {
  const { url, regenerate } = input;
  if (url === undefined && !regenerate) return { ok: true, update: {} };
  if (url === null) return { ok: true, update: { lead_webhook_url: null, lead_webhook_secret: null } };

  // RLS scopes both reads to the caller's organization.
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('organization_id, lead_webhook_url, lead_webhook_secret')
    .eq('id', chatbotId)
    .single();
  if (!chatbot) return { ok: false, status: 404, error: 'Chatbot introuvable.' };

  const effectiveUrl = url ?? chatbot.lead_webhook_url;
  if (!effectiveUrl) return { ok: false, status: 400, error: "Aucun webhook n'est configuré." };

  const { data: org } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', chatbot.organization_id)
    .single();
  if (!org || !LEAD_WEBHOOK_ALLOWED_PLANS.includes(org.plan)) {
    return { ok: false, status: 403, error: 'Le webhook de leads nécessite le plan PME ou Métier.' };
  }

  if (url !== undefined) {
    try {
      await assertPublicHostname(new URL(url).hostname);
    } catch (err) {
      if (err instanceof BlockedAddressError) return { ok: false, status: 400, error: err.message };
      return { ok: false, status: 400, error: "L'adresse du webhook n'est pas valide." };
    }
  }

  const needsSecret = regenerate || !chatbot.lead_webhook_secret;
  return {
    ok: true,
    update: {
      ...(url !== undefined ? { lead_webhook_url: url } : {}),
      ...(needsSecret ? { lead_webhook_secret: encryptText(generateWebhookSecret()) } : {}),
    },
  };
}
