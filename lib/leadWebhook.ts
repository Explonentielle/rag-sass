import { createHmac, randomBytes, randomUUID } from 'crypto';
import { assertPublicHostname, BlockedAddressError } from '@/lib/ssrfGuard';
import { decryptText, UNREADABLE_PLACEHOLDER } from '@/lib/crypto';
import { logInfo, logWarn } from '@/lib/logger';

// Webhook sortant « nouveau lead » (docs/roadmap.md item 62) : à chaque lead
// qualifié ou demande de rappel, le chatbot envoie un POST JSON signé à l'URL
// configurée par le propriétaire (Zapier, Make, un CRM...).

export const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_URL_CHARS = 2048;

export type LeadWebhookEvent = 'lead.qualified' | 'contact.requested' | 'test.ping';

export interface WebhookTarget {
  url: string;
  secret: string;
}

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

/** Signature HMAC-SHA256 de `${timestamp}.${body}` : le destinataire la recalcule avec son secret. */
export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** null ou chaîne vide efface ; sinon une URL https sans identifiants intégrés. */
export function validateWebhookUrl(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false, error: "L'adresse du webhook doit être une chaîne (ou null)." };
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > MAX_URL_CHARS) return { ok: false, error: "L'adresse du webhook est trop longue." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "L'adresse du webhook n'est pas une URL valide." };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: "L'adresse du webhook doit commencer par https:// (le secret ne doit pas circuler en clair)." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "L'adresse du webhook ne doit pas contenir d'identifiants." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Envoie un évènement signé. Ne lève jamais : le résultat dit ce qui s'est
 * passé, pour que l'appelant (un outil du chat, le bouton de test) décide
 * quoi en faire sans jamais casser la conversation.
 */
export async function deliverWebhook(
  target: WebhookTarget,
  event: LeadWebhookEvent,
  data: Record<string, unknown>
): Promise<DeliveryResult> {
  let url: URL;
  try {
    url = new URL(target.url);
    if (url.protocol !== 'https:') return { ok: false, error: "L'adresse du webhook doit être en https." };
    await assertPublicHostname(url.hostname);
  } catch (err) {
    if (err instanceof BlockedAddressError) return { ok: false, error: err.message };
    return { ok: false, error: "L'adresse du webhook n'est pas valide." };
  }

  const deliveryId = randomUUID();
  const body = JSON.stringify({
    id: deliveryId,
    event,
    occurred_at: new Date().toISOString(),
    data,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      signal: controller.signal,
      // Jamais de redirection suivie : une redirection vers une adresse
      // privée contournerait la vérification faite juste au-dessus.
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CorpusAi-Webhook/1.0',
        'X-Corpus-Event': event,
        'X-Corpus-Delivery': deliveryId,
        'X-Corpus-Timestamp': timestamp,
        'X-Corpus-Signature': `sha256=${signWebhookBody(target.secret, timestamp, body)}`,
      },
      body,
    });
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: `Le destinataire a répondu ${res.status}.` };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ok: false, error: aborted ? 'Le destinataire ne répond pas (délai dépassé).' : 'Envoi impossible.' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Cible d'envoi d'un chatbot, ou null si le webhook n'est pas (ou plus)
 * utilisable : pas d'URL, pas de secret, ou secret illisible. Un secret
 * illisible ne doit jamais être utilisé pour signer (decryptText renvoie un
 * texte de remplacement au lieu de lever) : mieux vaut ne rien envoyer qu'un
 * évènement dont la signature ne se vérifiera jamais.
 */
export function resolveWebhookTarget(
  url: string | null,
  encryptedSecret: string | null
): WebhookTarget | null {
  if (!url || !encryptedSecret) return null;
  const secret = decryptText(encryptedSecret);
  if (secret === UNREADABLE_PLACEHOLDER) return null;
  return { url, secret };
}

export type LeadWebhookNotifier = (
  event: 'lead.qualified' | 'contact.requested',
  fields: Record<string, string>
) => Promise<void>;

/**
 * Fonction que les outils du chat appellent quand un lead apparaît. Renvoie
 * undefined si aucun webhook n'est configuré. Meilleur effort : un échec est
 * journalisé (sans le contenu, voir lib/logger.ts) et ne remonte jamais.
 */
export function createLeadWebhookNotifier(
  target: WebhookTarget | null,
  base: { chatbot: { id: string; name: string }; conversationId: string },
  logCtx: Record<string, unknown>
): LeadWebhookNotifier | undefined {
  if (!target) return undefined;
  return async (event, fields) => {
    const result = await deliverWebhook(target, event, {
      chatbot: base.chatbot,
      conversation_id: base.conversationId,
      ...fields,
    });
    if (result.ok) {
      logInfo('lead_webhook.delivered', { ...logCtx, event, status: result.status });
    } else {
      logWarn('lead_webhook.failed', { ...logCtx, event, status: result.status, error: result.error });
    }
  };
}
