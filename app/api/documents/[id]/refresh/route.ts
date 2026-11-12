import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshUrlDocument } from '@/lib/sourceRefresh';
import { logError } from '@/lib/logger';

// Re-reads one web page right now (docs/roadmap.md item 61): the same logic
// as the daily cron, on demand, for a client who just updated their site.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS scopes both reads to the caller's organization.
  const { data: document } = await supabase
    .from('documents')
    .select('id, chatbot_id, file_type, source_url, content_hash, status')
    .eq('id', params.id)
    .single();
  if (!document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }
  if (document.file_type !== 'url') {
    return NextResponse.json({ error: 'Seules les pages web peuvent être actualisées.' }, { status: 400 });
  }
  if (document.status === 'pending' || document.status === 'processing') {
    return NextResponse.json({ error: 'Ce document est déjà en cours de traitement.' }, { status: 409 });
  }

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, organization_id, use_ai_indexing')
    .eq('id', document.chatbot_id)
    .single();
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
  }

  try {
    const result = await refreshUrlDocument(supabase, document, chatbot);
    if (result.outcome === 'failed') {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ outcome: result.outcome });
  } catch (err) {
    logError('source_refresh.manual_failed', {
      documentId: document.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "L'actualisation a échoué." }, { status: 500 });
  }
}
