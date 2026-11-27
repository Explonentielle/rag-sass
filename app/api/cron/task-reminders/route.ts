import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendOverdueTaskReminders } from '@/lib/taskReminders';
import { logError } from '@/lib/logger';

// Voir le commentaire équivalent dans app/api/cron/purge-conversations/
// route.ts : sans CRON_SECRET, forcer le mode dynamique évite que Next.js
// optimise cette route statiquement et ne l'exécute qu'au build.
export const dynamic = 'force-dynamic';

// Planifié par vercel.json (quotidien), docs/roadmap.md item 73.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const result = await sendOverdueTaskReminders(getAdminClient());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('cron.task_reminders_failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
