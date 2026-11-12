import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deliverWebhook, resolveWebhookTarget } from '@/lib/leadWebhook';

// Sends a `test.ping` event to the chatbot's configured webhook
// (docs/roadmap.md item 62) so the owner can wire up Zapier/Make and check
// the signature without waiting for a real lead.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS scopes this to chatbots the caller's organization owns.
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, name, lead_webhook_url, lead_webhook_secret')
    .eq('id', params.id)
    .single();
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
  }

  const target = resolveWebhookTarget(chatbot.lead_webhook_url, chatbot.lead_webhook_secret);
  if (!target) {
    return NextResponse.json({ error: "Aucun webhook utilisable n'est configuré." }, { status: 400 });
  }

  const result = await deliverWebhook(target, 'test.ping', {
    chatbot: { id: chatbot.id, name: chatbot.name },
    message: 'Évènement de test envoyé depuis Corpus.ai.',
  });
  return NextResponse.json(result);
}
