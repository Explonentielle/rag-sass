import { NextResponse } from 'next/server';
import { reportDbError } from '@/lib/userErrors';
import { File } from 'node:buffer';
import { v4 as uuidv4 } from 'uuid';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase/server';
import { detectFileType } from '@/lib/extract';
import { processDocument } from '@/lib/ingest';
import { logWarn, logError } from '@/lib/logger';
import { sanitizeFilenameForPath } from '@/lib/visitorFileRules';
import { AUDIO_TRANSCRIPTION_ALLOWED_PLANS } from '@/lib/plans';
import type { OrgPlan } from '@/types/database';

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
      .select('id, organization_id, use_ai_indexing, use_case, document_format, organizations!inner(plan)')
      .eq('id', chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      logWarn('upload.chatbot_not_found', { userId: user.id, chatbotId, error: chatbotError?.message });
      return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
    }

    // Contract analyzer (docs/roadmap.md item 23): one contract per
    // analysis by design (isolated, not mixed into a shared knowledge
    // base) — the dedicated creation flow (components/CreateContractForm.tsx)
    // never sends a second file, this guards direct API use.
    if (chatbot.use_case === 'contract_analyzer') {
      const { count, error: countError } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('chatbot_id', chatbot.id);
      if (countError) {
        const { message } = reportDbError('upload.count_failed', countError, { chatbotId: chatbot.id });
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if ((count ?? 0) >= 1) {
        return NextResponse.json(
          { error: "Une analyse de contrat ne peut contenir qu'un seul document. Supprimez-la et recommencez pour en analyser un autre." },
          { status: 400 }
        );
      }
    }

    const fileType = detectFileType(file.name);
    if (!fileType) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      logWarn('upload.unsupported_format', { userId: user.id, chatbotId, filename: file.name, ext });
      return NextResponse.json(
        {
          error: `Le format .${ext} n'est pas encore supporté (seuls .pdf, .docx, .txt, .md, .csv, .xlsx, .xls, .png, .jpg/.jpeg, .webp et les formats audio (.webm, .mp4, .m4a, .mp3, .wav) le sont pour l'instant).`,
        },
        { status: 400 }
      );
    }

    // Transcription de réunions (docs/roadmap.md item 46), premium : gardée
    // ici plutôt que côté UI seulement (components/AudioRecorder.tsx), pour
    // qu'un appel direct à cette route ne contourne pas le palier requis.
    if (fileType === 'audio') {
      // postgrest-js's type inference for a joined column doesn't narrow to
      // OrgPlan here (pre-existing gap, same pattern as app/api/chat/
      // route.ts): annotate explicitly.
      const org = Array.isArray(chatbot.organizations) ? chatbot.organizations[0] : chatbot.organizations;
      const plan: OrgPlan | undefined = org?.plan;
      if (!plan || !AUDIO_TRANSCRIPTION_ALLOWED_PLANS.includes(plan)) {
        return NextResponse.json(
          { error: 'La transcription de réunions nécessite le plan PME ou Métier.' },
          { status: 403 }
        );
      }
    }

    // sanitizeFilenameForPath strips accents/spaces/apostrophes etc. —
    // Supabase Storage's object key validation rejects some of these
    // (seen in prod with an accented filename: "Invalid key"), so the raw
    // file.name can't be used directly here. The original name is kept
    // as-is in the `filename` column below for display.
    const storagePath = `${chatbot.organization_id}/${chatbot.id}/${uuidv4()}-${sanitizeFilenameForPath(file.name)}`;
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
        { error: "Échec de l'upload. Réessayez, ou contactez le support si ça persiste." },
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
        { error: "Échec de l'enregistrement. Réessayez, ou contactez le support si ça persiste." },
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
        analyzeContract: chatbot.use_case === 'contract_analyzer',
        documentFormat: chatbot.use_case === 'paperwork_digitizer' ? chatbot.document_format : null,
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
    return NextResponse.json(
      { error: "Erreur serveur lors de l'upload. Réessayez, ou contactez le support si ça persiste." },
      { status: 500 }
    );
  }
}
