import { NextResponse } from 'next/server';
import { File } from 'node:buffer';
import { v4 as uuidv4 } from 'uuid';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { detectFileType } from '@/lib/extract';
import { processDocument } from '@/lib/ingest';
import { logWarn, logError } from '@/lib/logger';

// Ingestion (extraction/chunking/embeddings/indexing) runs in the background
// after the response is sent — see the waitUntil call below — so this only
// bounds how long the background work itself is allowed to run, not the
// client's wait time. Large PDFs can still take a while to embed/index.
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

    const formData = await request.formData();
    const chatbotId = formData.get('chatbotId');
    const file = formData.get('file');

    if (typeof chatbotId !== 'string' || !(file instanceof File)) {
      logWarn('upload.bad_request', { userId: user.id, chatbotId });
      return NextResponse.json({ error: 'chatbotId et file sont requis.' }, { status: 400 });
    }

    // RLS scopes this select to chatbots the user's org owns; a chatbotId
    // from another tenant simply won't be found.
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, organization_id, use_ai_indexing')
      .eq('id', chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      logWarn('upload.chatbot_not_found', { userId: user.id, chatbotId, error: chatbotError?.message });
      return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
    }

    const fileType = detectFileType(file.name);
    if (!fileType) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      logWarn('upload.unsupported_format', { userId: user.id, chatbotId, filename: file.name, ext });
      return NextResponse.json(
        {
          error: `Le format .${ext} n'est pas encore supporté (seuls .pdf, .docx, .txt, .md, .csv, .xlsx et .xls le sont pour l'instant).`,
        },
        { status: 400 }
      );
    }

    const storagePath = `${chatbot.organization_id}/${chatbot.id}/${uuidv4()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadError) {
      logError('upload.storage_failed', {
        userId: user.id,
        chatbotId,
        filename: file.name,
        error: uploadError.message,
      });
      return NextResponse.json(
        { error: `Upload échoué: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        chatbot_id: chatbot.id,
        filename: file.name,
        file_type: fileType,
        storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !document) {
      logError('upload.insert_failed', {
        userId: user.id,
        chatbotId,
        filename: file.name,
        error: insertError?.message,
      });
      return NextResponse.json(
        { error: `Enregistrement échoué: ${insertError?.message}` },
        { status: 500 }
      );
    }

    // Fire-and-forget: respond as soon as the file is saved instead of
    // making the client wait for extraction/chunking/embeddings/indexing.
    // waitUntil keeps this invocation alive for the background work (up to
    // maxDuration) on Vercel; on a persistent server (self-hosted/VPS) the
    // promise just runs in the same process either way. The client polls
    // GET /api/documents/[id] for status (see DocumentUploader.tsx).
    waitUntil(
      processDocument(supabase, {
        documentId: document.id,
        chatbotId: chatbot.id,
        organizationId: chatbot.organization_id,
        storagePath,
        fileType,
        filename: file.name,
        useAiIndexing: chatbot.use_ai_indexing,
      }).catch((err) => {
        logError('upload.background_processing_uncaught', {
          documentId: document.id,
          error: err instanceof Error ? err.message : String(err),
        });
      })
    );

    return NextResponse.json({ document });
  } catch (err) {
    // Last-resort safety net: any uncaught exception above still returns a
    // clean JSON error instead of a raw 500 with no body (which the client
    // can't parse, so it falls back to a generic, unhelpful message).
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('upload.uncaught_exception', {
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 });
  }
}
