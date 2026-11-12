import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { encryptText } from '@/lib/crypto';
import { logError } from '@/lib/logger';
import { sanitizeFilenameForPath } from '@/lib/visitorFileRules';
import type { EmailAttachment } from '@/lib/email';

// Server-side storage of files visitors send in the chat widget
// (docs/roadmap.md item 48). Rules (size, types) live in
// lib/visitorFileRules.ts so the widget can apply them too.

export const CONVERSATION_FILES_BUCKET = 'conversation-files';

const MAX_STORED_FILENAME_CHARS = 120;

type Client = SupabaseClient<Database>;

export interface ConversationAttachment {
  id: string;
  filename: string;
}

export async function countConversationFiles(client: Client, conversationId: string): Promise<number> {
  const { count, error } = await client
    .from('conversation_files')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (error) {
    logError('conversation_files.count_failed', { conversationId, error: error.message });
    throw new Error(`Impossible de compter les fichiers: ${error.message}`);
  }
  return count ?? 0;
}

// Same literal text storeVisitorFile writes as the message's content below
// — kept as one constant so VISITOR_FILE_PROMPT_NOTE's instructions to the
// model describe exactly what it'll actually see in its own history, not a
// copy that can drift out of sync with it.
export const ATTACHMENT_MESSAGE_PREFIX = 'Fichier joint : ';

// Carve-out from buildSystemPrompt's "N'utilise aucune connaissance externe
// à ces extraits" grounding rule (lib/prompts.ts), same lesson as
// NOTIFY_OWNER_PROMPT_NOTE (docs/roadmap.md item 33): without this, a
// visitor asking "did you get my file?" got answered purely from RAG
// retrieval — which, finding nothing about the widget's own upload feature,
// either said no or (worse) described an unrelated "contact form" upload
// process some site happened to have indexed — instead of the model simply
// reading its own conversation history, where the attachment already is.
export const VISITOR_FILE_PROMPT_NOTE = `Quand l'historique de la conversation contient un message de l'interlocuteur commençant par "${ATTACHMENT_MESSAGE_PREFIX}", cela signifie qu'il a réellement envoyé ce fichier via le widget de chat : ce n'est pas une connaissance externe interdite par la règle ci-dessus, c'est un fait de la conversation en cours. Si on te demande si tu as bien reçu un document, confirme-le en citant son nom exact tel qu'il apparaît dans l'historique. Tu ne peux en revanche pas lire ni analyser son contenu : ne décris jamais ce qu'il contient, dis simplement qu'il a bien été reçu et transmis.`;

/**
 * Stores the file, then records it in the conversation as a user message
 * ("Fichier joint : nom") plus a conversation_files row. If any step after
 * the upload fails, what was already written is rolled back — no orphan
 * object in Storage, no dangling message.
 */
export async function storeVisitorFile(
  admin: Client,
  params: {
    organizationId: string;
    chatbotId: string;
    conversationId: string;
    filename: string;
    contentType: string;
    data: Buffer;
  }
): Promise<{ file: ConversationAttachment; content: string }> {
  const { organizationId, chatbotId, conversationId, contentType, data } = params;
  const filename = params.filename.slice(-MAX_STORED_FILENAME_CHARS);
  const fileId = crypto.randomUUID();
  const storagePath = `${organizationId}/${chatbotId}/${conversationId}/${fileId}-${sanitizeFilenameForPath(filename)}`;
  const content = `${ATTACHMENT_MESSAGE_PREFIX}${filename}`;

  const { error: uploadError } = await admin.storage
    .from(CONVERSATION_FILES_BUCKET)
    .upload(storagePath, data, { contentType, upsert: false });
  if (uploadError) {
    logError('conversation_files.upload_failed', { chatbotId, conversationId, error: uploadError.message });
    throw new Error("Impossible d'enregistrer le fichier.");
  }

  async function rollback(messageId?: string) {
    await admin.storage.from(CONVERSATION_FILES_BUCKET).remove([storagePath]);
    if (messageId) await admin.from('messages').delete().eq('id', messageId);
  }

  const { data: message, error: messageError } = await admin
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'user', content: encryptText(content), sources: null })
    .select('id')
    .single();
  if (messageError || !message) {
    logError('conversation_files.message_failed', { chatbotId, conversationId, error: messageError?.message });
    await rollback();
    throw new Error("Impossible d'enregistrer le fichier.");
  }

  const { error: rowError } = await admin.from('conversation_files').insert({
    id: fileId,
    chatbot_id: chatbotId,
    conversation_id: conversationId,
    message_id: message.id,
    filename,
    size_bytes: data.length,
    storage_path: storagePath,
  });
  if (rowError) {
    logError('conversation_files.row_failed', { chatbotId, conversationId, error: rowError.message });
    await rollback(message.id);
    throw new Error("Impossible d'enregistrer le fichier.");
  }

  await admin
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return { file: { id: fileId, filename }, content };
}

/** message_id -> attachment, to decorate a conversation's replayed history. */
export async function loadAttachmentsByMessage(
  client: Client,
  conversationId: string
): Promise<Map<string, ConversationAttachment>> {
  const { data, error } = await client
    .from('conversation_files')
    .select('id, message_id, filename')
    .eq('conversation_id', conversationId);

  if (error) {
    logError('conversation_files.load_by_message_failed', { conversationId, error: error.message });
    throw new Error(`Impossible de charger les fichiers: ${error.message}`);
  }
  return new Map((data ?? []).map((row) => [row.message_id, { id: row.id, filename: row.filename }]));
}

/** conversation_id -> files, for the dashboard's conversation list. */
export async function listFilesByConversationForChatbot(
  client: Client,
  chatbotId: string
): Promise<Map<string, ConversationAttachment[]>> {
  const { data, error } = await client
    .from('conversation_files')
    .select('id, conversation_id, filename')
    .eq('chatbot_id', chatbotId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('conversation_files.list_failed', { chatbotId, error: error.message });
    throw new Error(`Impossible de lister les fichiers: ${error.message}`);
  }

  const byConversation = new Map<string, ConversationAttachment[]>();
  for (const row of data ?? []) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push({ id: row.id, filename: row.filename });
    byConversation.set(row.conversation_id, list);
  }
  return byConversation;
}

/** Every file of the conversation as email attachments. A file that can't be
 * downloaded is skipped (and logged) rather than blocking the notification. */
export async function loadConversationAttachments(
  admin: Client,
  conversationId: string
): Promise<EmailAttachment[]> {
  const { data, error } = await admin
    .from('conversation_files')
    .select('filename, storage_path')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    logError('conversation_files.attachments_query_failed', { conversationId, error: error.message });
    return [];
  }

  const attachments: EmailAttachment[] = [];
  for (const row of data ?? []) {
    const { data: blob, error: downloadError } = await admin.storage
      .from(CONVERSATION_FILES_BUCKET)
      .download(row.storage_path);
    if (downloadError || !blob) {
      logError('conversation_files.attachment_download_failed', {
        conversationId,
        error: downloadError?.message,
      });
      continue;
    }
    attachments.push({ filename: row.filename, content: Buffer.from(await blob.arrayBuffer()) });
  }
  return attachments;
}

/**
 * Removes the Storage objects of a conversation (or of every conversation of
 * some chatbots). Call it *before* deleting the conversation/chatbot: the
 * conversation_files rows cascade away with them, and with the rows go the
 * paths. A Storage failure is logged, not thrown — same stance as chatbot
 * deletion: finishing the deletion beats leaving it half-done, and the log
 * says which objects to clean by hand.
 */
export async function removeConversationFiles(
  client: Client,
  scope: { conversationId: string } | { conversationIds: string[] } | { chatbotIds: string[] }
): Promise<void> {
  const base = client.from('conversation_files').select('storage_path');
  const { data, error } =
    'conversationId' in scope
      ? await base.eq('conversation_id', scope.conversationId)
      : 'conversationIds' in scope
        ? await base.in('conversation_id', scope.conversationIds)
        : await base.in('chatbot_id', scope.chatbotIds);

  if (error) {
    logError('conversation_files.paths_query_failed', { error: error.message });
    return;
  }
  const paths = (data ?? []).map((row) => row.storage_path);
  if (paths.length === 0) return;

  const { error: removeError } = await client.storage.from(CONVERSATION_FILES_BUCKET).remove(paths);
  if (removeError) {
    logError('conversation_files.remove_failed', { error: removeError.message, fileCount: paths.length });
  }
}
