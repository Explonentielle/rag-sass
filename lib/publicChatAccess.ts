import type { getAdminClient } from '@/lib/supabase/admin';
import type { OrgPlan, OrgOverageMode } from '@/types/database';
import { getRequestOrigin, isOriginAllowed } from '@/lib/embedAccess';
import { logError } from '@/lib/logger';

// Shared by every anonymous visitor endpoint (app/api/public-chat and
// app/api/public-chat/files) — route files can't export helpers, so the
// access check lives here once instead of being copied.

export function isValidVisitorId(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f-]{16,64}$/i.test(v);
}

export type ChatbotAccessResult =
  | {
      ok: true;
      chatbot: {
        id: string;
        name: string;
        lead_webhook_url: string | null;
        lead_webhook_secret: string | null;
        organization_id: string;
        system_prompt_template: string;
        use_documents: boolean;
        allow_email_tool: boolean;
        notification_email: string | null;
        allow_visitor_uploads: boolean;
        allow_lead_qualification: boolean;
        lead_qualification_criteria: string | null;
        meeting_link: string | null;
        plan: OrgPlan;
        overage_mode: OrgOverageMode;
      };
    }
  | { ok: false; reason: 'not_found' | 'private' | 'origin_blocked' };

/**
 * Looks up a chatbot and checks it's reachable anonymously from this
 * request: exists, `is_public`, and — if the owner configured any —
 * `allowed_origins` includes the caller's Origin/Referer. Same-origin
 * requests (our own domain, e.g. the site's own FloatingChatWidget, or a
 * fetch made by JS running *inside* our /embed/[chatbotId] iframe — that JS
 * is same-origin to us, not to the parent page framing it) always pass;
 * `allowed_origins` only applies to *other* origins calling this API
 * directly. Restricting which sites may actually iframe /embed/[chatbotId]
 * is a separate, browser-enforced mechanism (CSP frame-ancestors, see
 * middleware.ts) — an Origin check here can't see who framed the page that
 * made the fetch, only what page made it.
 */
export async function getAccessibleChatbot(
  admin: ReturnType<typeof getAdminClient>,
  chatbotId: string,
  request: Request
): Promise<ChatbotAccessResult> {
  const { data: chatbot, error } = await admin
    .from('chatbots')
    .select(
      'id, name, organization_id, system_prompt_template, is_public, allowed_origins, use_documents, use_case, allow_email_tool, notification_email, allow_visitor_uploads, allow_lead_qualification, lead_qualification_criteria, meeting_link, lead_webhook_url, lead_webhook_secret, organizations!inner(plan, overage_mode)'
    )
    .eq('id', chatbotId)
    .single();

  // PGRST116 = .single() found zero (or more than one) row — a genuine
  // "doesn't exist". Any other error is a real query failure (DB timeout,
  // connection issue...) that would otherwise look identical to a deleted
  // chatbot in the logs, with no way to tell the two apart after the fact.
  if (error && error.code !== 'PGRST116') {
    logError('public_chat_access.query_failed', { chatbotId, error: error.message, code: error.code });
  }
  if (error || !chatbot) return { ok: false, reason: 'not_found' };
  // Only a 'site_widget' chatbot is ever reachable anonymously — checked
  // here (the one chokepoint shared by every anonymous endpoint) rather
  // than relying on `is_public` alone: 'second_cerveau' and
  // 'contract_analyzer' chatbots are meant to stay internal regardless of
  // what `is_public`/`allowed_origins` happen to hold (their dashboard UI
  // never exposes a way to change either), so this can't be bypassed by a
  // stale row, a future UI bug, or a direct API call.
  if (chatbot.use_case !== 'site_widget') return { ok: false, reason: 'private' };
  if (!chatbot.is_public) return { ok: false, reason: 'private' };

  const selfOrigin = new URL(request.url).origin;
  const requestOrigin = getRequestOrigin(request);
  const originOk = requestOrigin === selfOrigin || isOriginAllowed(requestOrigin, chatbot.allowed_origins);
  if (!originOk) return { ok: false, reason: 'origin_blocked' };

  const org = Array.isArray(chatbot.organizations) ? chatbot.organizations[0] : chatbot.organizations;
  return { ok: true, chatbot: { ...chatbot, plan: org.plan, overage_mode: org.overage_mode } };
}
