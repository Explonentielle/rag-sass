import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { refreshUrlDocument } from '@/lib/sourceRefresh';
import { isRefreshDue } from '@/lib/sourceRefreshRules';
import { logInfo, logError } from '@/lib/logger';
import type { DocumentStatus, SourceRefreshFrequency } from '@/types/database';

// Same reasoning as the other crons: keeps this off the static-optimization
// path so it only runs on the real Vercel Cron schedule.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// One run handles a bounded batch, oldest check first, so a large backlog is
// worked through over several days instead of timing out. The time guard
// stops before the platform kills the invocation mid-ingestion.
const MAX_DOCUMENTS_PER_RUN = 20;
const TIME_BUDGET_MS = 240_000;

interface CandidateRow {
  id: string;
  chatbot_id: string;
  source_url: string | null;
  content_hash: string | null;
  status: DocumentStatus;
  last_checked_at: string | null;
  chatbots: {
    id: string;
    organization_id: string;
    use_ai_indexing: boolean;
    source_refresh: SourceRefreshFrequency;
  };
}

/**
 * Daily re-read of web pages whose chatbot has automatic refresh turned on
 * (docs/roadmap.md item 61, scheduled in vercel.json). A page is re-indexed
 * only if its extracted text actually changed (content hash), so an
 * unchanged site costs a fetch and nothing else.
 */
export async function GET(request: Request) {
  // Fails closed like app/api/cron/charge-overage/route.ts: this triggers
  // outbound fetches and paid embedding calls, so a missing CRON_SECRET must
  // deny access rather than leave the endpoint open.
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const results = { updated: 0, unchanged: 0, failed: 0, remaining: 0 };

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('documents')
      .select(
        'id, chatbot_id, source_url, content_hash, status, last_checked_at, chatbots!inner(id, organization_id, use_ai_indexing, source_refresh)'
      )
      .eq('file_type', 'url')
      .in('status', ['indexed', 'error'])
      .neq('chatbots.source_refresh', 'off')
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(500)
      .returns<CandidateRow[]>();

    if (error) throw error;

    const due = (data ?? []).filter((row) => isRefreshDue(row.chatbots.source_refresh, row.last_checked_at, now));
    const batch = due.slice(0, MAX_DOCUMENTS_PER_RUN);
    results.remaining = due.length - batch.length;

    for (const row of batch) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        results.remaining += 1;
        continue;
      }
      try {
        const outcome = await refreshUrlDocument(admin, row, row.chatbots);
        if (outcome.outcome === 'updated') results.updated += 1;
        else if (outcome.outcome === 'unchanged') results.unchanged += 1;
        else results.failed += 1;
      } catch (err) {
        results.failed += 1;
        logError('source_refresh.document_uncaught', {
          documentId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logInfo('source_refresh.cron_done', results);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('source_refresh.cron_failed', { error: message });
    return NextResponse.json({ error: 'Échec de la mise à jour des sources.' }, { status: 500 });
  }
}
