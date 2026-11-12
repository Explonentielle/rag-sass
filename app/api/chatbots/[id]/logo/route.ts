import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { CHATBOT_LOGOS_BUCKET, getLogoPublicUrl, removeChatbotLogos } from '@/lib/chatbotLogo';
import { LOGO_CONTENT_TYPES, MAX_LOGO_BYTES, validateLogoBytes } from '@/lib/widgetAppearance';
import { logError } from '@/lib/logger';

// Logo du widget (docs/roadmap.md item 60). L'appartenance du chatbot à
// l'organisation de l'appelant est vérifiée par la RLS (lecture du chatbot
// avec le client de session) ; l'écriture dans le bucket passe ensuite par le
// client service-role, car le bucket n'a volontairement aucune policy d'écriture.

async function loadOwnChatbot(chatbotId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) };

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, logo_path')
    .eq('id', chatbotId)
    .single();
  if (!chatbot) return { error: NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 }) };
  return { supabase, chatbot };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadOwnChatbot(params.id);
  if ('error' in loaded) return loaded.error;
  const { supabase, chatbot } = loaded;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
  }
  // Rejeté avant lecture : évite de charger en mémoire un fichier énorme.
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: `Le logo dépasse ${MAX_LOGO_BYTES / 1024} Ko.` }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateLogoBytes(bytes);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const admin = getAdminClient();
  const path = `${chatbot.id}/${randomUUID()}.${validation.value}`;
  const { error: uploadError } = await admin.storage
    .from(CHATBOT_LOGOS_BUCKET)
    .upload(path, bytes, { contentType: LOGO_CONTENT_TYPES[validation.value] });
  if (uploadError) {
    logError('chatbot_logo.upload_failed', { chatbotId: chatbot.id, error: uploadError.message });
    return NextResponse.json({ error: "Impossible d'enregistrer le logo." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('chatbots')
    .update({ logo_path: path })
    .eq('id', chatbot.id);
  if (updateError) {
    await removeChatbotLogos(admin, [path]);
    logError('chatbot_logo.update_failed', { chatbotId: chatbot.id, error: updateError.message });
    return NextResponse.json({ error: "Impossible d'enregistrer le logo." }, { status: 500 });
  }

  await removeChatbotLogos(admin, [chatbot.logo_path]);
  return NextResponse.json({ logoUrl: getLogoPublicUrl(admin, path) });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const loaded = await loadOwnChatbot(params.id);
  if ('error' in loaded) return loaded.error;
  const { supabase, chatbot } = loaded;

  const { error } = await supabase.from('chatbots').update({ logo_path: null }).eq('id', chatbot.id);
  if (error) {
    logError('chatbot_logo.clear_failed', { chatbotId: chatbot.id, error: error.message });
    return NextResponse.json({ error: 'Impossible de retirer le logo.' }, { status: 500 });
  }
  await removeChatbotLogos(getAdminClient(), [chatbot.logo_path]);
  return NextResponse.json({ ok: true });
}
