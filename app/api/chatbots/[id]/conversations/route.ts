import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listAllConversationsForChatbot,
  deleteConversationForChatbot,
  loadHistoryForChatbot,
} from '@/lib/conversations';
import { logError } from '@/lib/logger';

// Dashboard admin tool (roadmap.md item 20-B): lists and deletes any
// conversation on a chatbot, across every identity (org test-chat users and
// anonymous widget visitors alike) — not just the caller's own. Lets a
// member handle a GDPR erasure request from a visitor who no longer has
// their localStorage visitorId. RLS still scopes everything to the caller's
// org (transitively via chatbots.organization_id), same trust model as
// documents/chatbots: any org member can manage any conversation on their
// org's chatbots.

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // Optional: ?conversationId=... returns that one conversation's full
  // message thread instead of the list — the dashboard's expandable row
  // detail (roadmap.md item 48).
  const conversationId = new URL(request.url).searchParams.get('conversationId');
  if (conversationId) {
    try {
      const messages = await loadHistoryForChatbot(supabase, conversationId, params.id);
      if (!messages) {
        return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });
      }
      return NextResponse.json({ messages });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue.';
      logError('admin_conversations.load_history_failed', {
        userId: user.id,
        chatbotId: params.id,
        conversationId,
        error: message,
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const conversations = await listAllConversationsForChatbot(supabase, params.id);
    return NextResponse.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('admin_conversations.list_failed', { userId: user.id, chatbotId: params.id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const conversationId = new URL(request.url).searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId est requis.' }, { status: 400 });
  }

  try {
    await deleteConversationForChatbot(supabase, conversationId, params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('admin_conversations.delete_failed', {
      userId: user.id,
      chatbotId: params.id,
      conversationId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
