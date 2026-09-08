import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MessageRole } from '@/types/database';
import type { ChatTurn } from '@/lib/openai';

export interface StoredMessage {
  role: MessageRole;
  content: string;
  sources: string[] | null;
}

export interface ConversationSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** First user message, for display in the switcher — null for a
   * conversation row that exists but never got a message appended (e.g.
   * generation failed right after creating it). */
  title: string | null;
}

interface ConversationIdentity {
  chatbotId: string;
  userId?: string;
  visitorId?: string;
}

export async function createConversation(
  supabase: SupabaseClient<Database>,
  identity: ConversationIdentity
): Promise<string> {
  const { chatbotId, userId, visitorId } = identity;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ chatbot_id: chatbotId, user_id: userId ?? null, visitor_id: visitorId ?? null })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Impossible de créer la conversation: ${error?.message}`);
  }
  return data.id;
}

/** Most recent conversations for this (chatbot, identity), for the switcher UI. */
export async function listConversations(
  supabase: SupabaseClient<Database>,
  identity: ConversationIdentity
): Promise<ConversationSummary[]> {
  const { chatbotId, userId, visitorId } = identity;
  let query = supabase
    .from('conversations')
    .select('id, created_at, updated_at')
    .eq('chatbot_id', chatbotId);
  query = userId ? query.eq('user_id', userId) : query.eq('visitor_id', visitorId!);

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) {
    throw new Error(`Impossible de lister les conversations: ${error.message}`);
  }
  const conversations = data ?? [];
  if (conversations.length === 0) return [];

  // One query for every conversation's first user message, ordered so the
  // first occurrence per conversation_id (reduced below) is the earliest —
  // simpler than a per-conversation query, and Postgres has no easy
  // "first row per group" via the query builder without a raw SQL view.
  const { data: firstMessages, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at')
    .in(
      'conversation_id',
      conversations.map((c) => c.id)
    )
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  if (msgError) {
    throw new Error(`Impossible de charger les titres de conversation: ${msgError.message}`);
  }

  const titleByConversation = new Map<string, string>();
  for (const msg of firstMessages ?? []) {
    if (!titleByConversation.has(msg.conversation_id)) {
      titleByConversation.set(msg.conversation_id, msg.content);
    }
  }

  return conversations.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: titleByConversation.get(row.id) ?? null,
  }));
}

/**
 * Fetches a conversation by id, scoped to this identity — used to verify
 * ownership before reading/appending to a client-supplied conversationId.
 * Returns null if it doesn't exist or belongs to someone else.
 */
export async function getConversationForIdentity(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  identity: ConversationIdentity
): Promise<{ id: string } | null> {
  const { chatbotId, userId, visitorId } = identity;
  let query = supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('chatbot_id', chatbotId);
  query = userId ? query.eq('user_id', userId) : query.eq('visitor_id', visitorId!);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Impossible de vérifier la conversation: ${error.message}`);
  }
  return data;
}

export async function loadHistory(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, sources')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Impossible de charger l'historique: ${error.message}`);
  }
  return data ?? [];
}

/** Maps stored history to the shape lib/openai.ts's streamAnswer expects. */
export function toChatTurns(history: StoredMessage[]): ChatTurn[] {
  return history.map(({ role, content }) => ({ role, content }));
}

export async function appendTurn(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  turn: { question: string; answer: string; sources: string[] }
): Promise<void> {
  const { error } = await supabase.from('messages').insert([
    { conversation_id: conversationId, role: 'user', content: turn.question, sources: null },
    { conversation_id: conversationId, role: 'assistant', content: turn.answer, sources: turn.sources },
  ]);

  if (error) {
    throw new Error(`Impossible d'enregistrer les messages: ${error.message}`);
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
