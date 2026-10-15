import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { purgeExpiredConversations } from '@/lib/retentionPurge';
import { logError } from '@/lib/logger';

// Without CRON_SECRET set, the auth check below never reads `request`
// (short-circuits on `expected &&`), so this handler has no dynamic-API
// usage Next.js can detect — it would otherwise get statically optimized
// and actually run once at *build* time (confirmed: logged
// `retention_purge.done` during `next build` before this was added),
// re-purging on every deploy instead of only on the real Vercel Cron
// schedule. Forcing dynamic is what the Vercel Cron Job actually needs.
export const dynamic = 'force-dynamic';

// Scheduled by vercel.json (daily) — docs/roadmap.md item 48. Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically on cron-triggered
// requests when that env var is set on the project; checked here so this
// endpoint can't be triggered by anyone who finds the URL. No check (and no
// risk) if CRON_SECRET is unset, e.g. local dev — matches how RESEND_API_KEY
// and other optional-until-configured env vars behave elsewhere.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const result = await purgeExpiredConversations(getAdminClient());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('cron.purge_conversations_failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
