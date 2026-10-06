import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteDocumentChunks } from '@/lib/elasticsearch';
import { logInfo, logError } from '@/lib/logger';

// Polled by DocumentUploader while a document is being processed in the
// background (see waitUntil in app/api/documents/upload/route.ts).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: document, error } = await supabase
    .from('documents')
    .select('id, status, error_message, chunk_count')
    .eq('id', params.id)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS (documents_select: scoped via chatbots.organization_id) enforces
  // tenant scoping — a documentId from another org simply won't be found.
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('id, storage_path, chatbot_id')
    .eq('id', params.id)
    .single();

  if (fetchError || !document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }

  try {
    await deleteDocumentChunks(document.id);
  } catch (err) {
    // Don't block the delete on an ES hiccup — better to clean up the DB
    // row and storage file than leave the user stuck with an undeletable
    // document. Log it so orphaned chunks can be traced later.
    logError('document.delete_es_failed', {
      documentId: document.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // URL-sourced documents (docs/roadmap.md item 18, point 5) have no
  // storage_path — nothing was ever uploaded to Storage for them.
  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([document.storage_path]);
    if (storageError) {
      logError('document.delete_storage_failed', {
        documentId: document.id,
        error: storageError.message,
      });
    }
  }

  const { error: deleteError } = await supabase.from('documents').delete().eq('id', document.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  logInfo('document.deleted', { documentId: document.id, chatbotId: document.chatbot_id });
  return NextResponse.json({ ok: true });
}
