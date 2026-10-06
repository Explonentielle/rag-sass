import { NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { processUrlDocument } from '@/lib/ingest';
import { logWarn, logError } from '@/lib/logger';

// Same reasoning as app/api/documents/upload/route.ts: ingestion runs in
// the background (waitUntil below), this only bounds that background work.
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const chatbotId: string | undefined = body?.chatbotId;
    const url: string | undefined = body?.url?.trim();

    if (!chatbotId || !url) {
      return NextResponse.json({ error: 'chatbotId et url sont requis.' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'URL invalide.' }, { status: 400 });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Seules les URL http/https sont autorisées.' }, { status: 400 });
    }

    // RLS scopes this select to chatbots the user's org owns; a chatbotId
    // from another tenant simply won't be found.
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, organization_id, use_ai_indexing')
      .eq('id', chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      logWarn('upload_url.chatbot_not_found', { userId: user.id, chatbotId, error: chatbotError?.message });
      return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
    }

    // The URL itself is stored as the filename (shown in the documents
    // table and cited as the source in chat answers) — more useful here
    // than a scraped page title, and known upfront unlike the title
    // (which only exists after extraction). No storage_path: nothing was
    // uploaded, see migration 0013.
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        chatbot_id: chatbot.id,
        filename: url,
        file_type: 'url',
        source_url: url,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !document) {
      logError('upload_url.insert_failed', {
        userId: user.id,
        chatbotId,
        url,
        error: insertError?.message,
      });
      return NextResponse.json(
        { error: `Enregistrement échoué: ${insertError?.message}` },
        { status: 500 }
      );
    }

    waitUntil(
      processUrlDocument(supabase, {
        documentId: document.id,
        chatbotId: chatbot.id,
        organizationId: chatbot.organization_id,
        url,
        useAiIndexing: chatbot.use_ai_indexing,
      }).catch((err) => {
        logError('upload_url.background_processing_uncaught', {
          documentId: document.id,
          error: err instanceof Error ? err.message : String(err),
        });
      })
    );

    return NextResponse.json({ document });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('upload_url.uncaught_exception', {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 });
  }
}
