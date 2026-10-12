import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONVERSATION_FILES_BUCKET } from '@/lib/conversationFiles';
import { logError } from '@/lib/logger';

// Dashboard download of a file a visitor sent in the chat (docs/roadmap.md
// item 48). Goes through the authenticated client on purpose: RLS on
// conversation_files and on the bucket (both org-member scoped) is the
// authorization check, so a file id from another tenant simply isn't found.
// Redirects to a short-lived signed URL instead of streaming the bytes
// through the app.
export async function GET(
  _request: Request,
  { params }: { params: { id: string; fileId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: file } = await supabase
    .from('conversation_files')
    .select('filename, storage_path')
    .eq('id', params.fileId)
    .eq('chatbot_id', params.id)
    .maybeSingle();

  if (!file) {
    return NextResponse.json({ error: 'Fichier introuvable.' }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(CONVERSATION_FILES_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.filename });

  if (error || !signed) {
    logError('conversation_files.sign_failed', {
      userId: user.id,
      chatbotId: params.id,
      fileId: params.fileId,
      error: error?.message,
    });
    return NextResponse.json({ error: 'Téléchargement indisponible.' }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
