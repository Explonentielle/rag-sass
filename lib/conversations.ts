import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MessageRole } from '@/types/database';
import type { ChatTurn } from '@/lib/openai';
import { encryptText, decryptText } from '@/lib/crypto';
import { logError } from '@/lib/logger';
import {
  loadAttachmentsByMessage,
  listFilesByConversationForChatbot,
  removeConversationFiles,
  type ConversationAttachment,
} from '@/lib/conversationFiles';

export interface StoredMessage {
  role: MessageRole;
  content: string;
  sources: string[] | null;
  /** Set when this user message is a file the visitor sent (roadmap item 48). */
  attachment?: ConversationAttachment | null;
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

export interface AdminConversationSummary extends ConversationSummary {
  /** Who this conversation belongs to — an org member (dashboard test chat)
   * or an anonymous widget visitor. Distinguishes the two in the admin list
   * since a chatbot mixes both. */
  identity: { type: 'user'; userId: string } | { type: 'visitor'; visitorId: string };
  /** Files the visitor sent in this conversation, for the dashboard list. */
  files: ConversationAttachment[];
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
    logError('conversations.create_failed', { chatbotId, userId, visitorId, error: error?.message });
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
    logError('conversations.list_failed', { chatbotId, userId, visitorId, error: error.message });
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
    logError('conversations.list_titles_failed', { chatbotId, error: msgError.message });
    throw new Error(`Impossible de charger les titres de conversation: ${msgError.message}`);
  }

  const titleByConversation = new Map<string, string>();
  for (const msg of firstMessages ?? []) {
    if (!titleByConversation.has(msg.conversation_id)) {
      titleByConversation.set(msg.conversation_id, decryptText(msg.content));
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
 * All conversations for a chatbot, across every identity — org test-chat
 * users and anonymous widget visitors alike. For the dashboard's GDPR
 * lookup tool: a member finds and deletes a specific visitor's conversation
 * on request, without needing that visitor's localStorage visitorId (see
 * roadmap.md item 20-B). Relies on RLS (conversations_select) to scope this
 * to the caller's org — no explicit organization filter needed here.
 */
export async function listAllConversationsForChatbot(
  supabase: SupabaseClient<Database>,
  chatbotId: string
): Promise<AdminConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, created_at, updated_at, user_id, visitor_id')
    .eq('chatbot_id', chatbotId)
    .order('updated_at', { ascending: false });

  if (error) {
    logError('conversations.list_all_failed', { chatbotId, error: error.message });
    throw new Error(`Impossible de lister les conversations: ${error.message}`);
  }
  const conversations = data ?? [];
  if (conversations.length === 0) return [];

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
    logError('conversations.list_all_titles_failed', { chatbotId, error: msgError.message });
    throw new Error(`Impossible de charger les titres de conversation: ${msgError.message}`);
  }

  const titleByConversation = new Map<string, string>();
  for (const msg of firstMessages ?? []) {
    if (!titleByConversation.has(msg.conversation_id)) {
      titleByConversation.set(msg.conversation_id, decryptText(msg.content));
    }
  }

  const filesByConversation = await listFilesByConversationForChatbot(supabase, chatbotId);

  return conversations.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: titleByConversation.get(row.id) ?? null,
    identity: row.user_id
      ? { type: 'user' as const, userId: row.user_id }
      : { type: 'visitor' as const, visitorId: row.visitor_id! },
    files: filesByConversation.get(row.id) ?? [],
  }));
}

/**
 * Deletes a conversation by id, scoped only to its chatbot — not to any
 * identity. Used by the dashboard admin tool (20-B), where a member deletes
 * a visitor's conversation on their behalf. RLS (conversations_delete)
 * still enforces that the caller belongs to the chatbot's org.
 */
export async function deleteConversationForChatbot(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  chatbotId: string
): Promise<void> {
  // Before the delete: the conversation_files rows (and their storage paths)
  // cascade away with the conversation. RLS scopes the lookup to the org, so
  // a conversationId from another tenant finds nothing here.
  await removeConversationFiles(supabase, { conversationId });

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('chatbot_id', chatbotId);

  if (error) {
    logError('conversations.delete_failed', { conversationId, chatbotId, error: error.message });
    throw new Error(`Impossible de supprimer la conversation: ${error.message}`);
  }
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
    logError('conversations.verify_ownership_failed', { conversationId, chatbotId, error: error.message });
    throw new Error(`Impossible de vérifier la conversation: ${error.message}`);
  }
  return data;
}

/** Decrypts one stored row. `sources` is a jsonb column: a plain string
 * means an encrypted blob (see lib/crypto.ts), an array means a legacy row
 * written before this feature existed — both are handled, no migration
 * needed for pre-existing data. */
function decryptStoredMessage(row: { role: MessageRole; content: string; sources: unknown }): StoredMessage {
  const rawSources = row.sources;
  let sources: string[] | null;
  if (typeof rawSources === 'string') {
    // decryptText never throws (see lib/crypto.ts) — but on a decrypt
    // failure it returns a placeholder string, which isn't valid JSON.
    // JSON.parse would throw on that, so this stays defensive too: no
    // sources rather than crashing the whole conversation over one row.
    try {
      sources = JSON.parse(decryptText(rawSources)) as string[];
    } catch {
      sources = null;
    }
  } else {
    sources = (rawSources as string[] | null) ?? null;
  }
  return { role: row.role, content: decryptText(row.content), sources };
}

export async function loadHistory(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, sources')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('conversations.load_history_failed', { conversationId, error: error.message });
    throw new Error(`Impossible de charger l'historique: ${error.message}`);
  }
  const attachments = await loadAttachmentsByMessage(supabase, conversationId);
  return (data ?? []).map((row) => ({
    ...decryptStoredMessage(row),
    attachment: attachments.get(row.id) ?? null,
  }));
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
  // sources is a jsonb column; storing the encrypted blob as its JSON string
  // value (rather than an array) is what decryptStoredMessage above expects
  // — the DB type says string[], but the cast is deliberate, see lib/crypto.ts.
  const encryptedSources = encryptText(JSON.stringify(turn.sources)) as unknown as string[];
  const { error } = await supabase.from('messages').insert([
    { conversation_id: conversationId, role: 'user', content: encryptText(turn.question), sources: null },
    { conversation_id: conversationId, role: 'assistant', content: encryptText(turn.answer), sources: encryptedSources },
  ]);

  if (error) {
    logError('conversations.append_turn_failed', { conversationId, error: error.message });
    throw new Error(`Impossible d'enregistrer les messages: ${error.message}`);
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
