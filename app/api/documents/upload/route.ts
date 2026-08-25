import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/server';
import { detectFileType } from '@/lib/extract';
import { processDocument } from '@/lib/ingest';

export const maxDuration = 300; // ingestion can take a while for larger files

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
      return NextResponse.json({ error: 'chatbotId et file sont requis.' }, { status: 400 });
    }

    // RLS scopes this select to chatbots the user's org owns; a chatbotId
    // from another tenant simply won't be found.
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, organization_id')
      .eq('id', chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
    }

    const fileType = detectFileType(file.name);
    if (!fileType) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      return NextResponse.json(
        {
          error: `Le format .${ext} n'est pas encore supporté (seuls .pdf, .docx, .txt et .md le sont pour l'instant).`,
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
      return NextResponse.json(
        { error: `Enregistrement échoué: ${insertError?.message}` },
        { status: 500 }
      );
    }

    const result = await processDocument(supabase, {
      documentId: document.id,
      chatbotId: chatbot.id,
      organizationId: chatbot.organization_id,
      storagePath,
      fileType,
      filename: file.name,
    });

    return NextResponse.json({
      document: { ...document, status: result.status, error_message: result.errorMessage ?? null },
    });
  } catch (err) {
    // Last-resort safety net: any uncaught exception above still returns a
    // clean JSON error instead of a raw 500 with no body (which the client
    // can't parse, so it falls back to a generic, unhelpful message).
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    return NextResponse.json({ error: `Erreur serveur: ${message}` }, { status: 500 });
  }
}
