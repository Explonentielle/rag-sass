import { getAdminClient } from '@/lib/supabase/admin';
import { getAccessibleChatbot, isValidVisitorId } from '@/lib/publicChatAccess';
import { checkPublicChatRateLimit, getClientIp } from '@/lib/rateLimit';
import { createConversation, getConversationForIdentity } from '@/lib/conversations';
import { countConversationFiles, saveFileExtraction, storeVisitorFile } from '@/lib/conversationFiles';
import { analyzeVisitorFile } from '@/lib/visitorFileAnalysis';
import {
  validateVisitorFile,
  MAX_FILES_PER_CONVERSATION,
  MAX_VISITOR_FILE_BYTES,
} from '@/lib/visitorFileRules';
import { logInfo, logWarn, logError } from '@/lib/logger';

// Visitor file upload for the public chat widget (docs/roadmap.md item 48).
// Same anonymous trust model as ../route.ts: access = chatbotId + is_public +
// allowed_origins + rate limit, identity = the visitorId persistence key.
// Opt-in per chatbot (`allow_visitor_uploads`, off by default). The file is
// stored with the conversation; only when `analyze_visitor_files` is also on
// is its text extracted so the chatbot can answer about it (item 63).

// Extraction (OCR for scans and images) runs inside this request, so it needs
// more room than the default; analyzeVisitorFile gives up on its own before this.
export const maxDuration = 60;

// Multipart overhead (boundaries, the other form fields) on top of the file.
const MAX_BODY_BYTES = MAX_VISITOR_FILE_BYTES + 64 * 1024;

export async function POST(request: Request) {
  // Cheap early rejection before buffering the body. Content-Length can be
  // absent or wrong — the real size is re-checked on the parsed file below.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response('Fichier trop volumineux.', { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const chatbotId = form?.get('chatbotId');
  const visitorId = form?.get('visitorId');
  const requestedConversationId = form?.get('conversationId');
  const file = form?.get('file');

  if (
    typeof chatbotId !== 'string' ||
    !chatbotId ||
    !isValidVisitorId(visitorId) ||
    !(file instanceof File)
  ) {
    return new Response('chatbotId, visitorId et file sont requis.', { status: 400 });
  }
  const conversationIdInput =
    typeof requestedConversationId === 'string' && requestedConversationId
      ? requestedConversationId
      : undefined;

  const ip = getClientIp(request);
  const rateLimit = checkPublicChatRateLimit(chatbotId, ip);
  if (!rateLimit.allowed) {
    if (rateLimit.blacklisted) {
      logWarn('public-chat-files.blacklisted_ip_blocked', { chatbotId, ip });
      return new Response('Accès bloqué.', { status: 403 });
    }
    logWarn('public-chat-files.rate_limited', { chatbotId, ip });
    return new Response('Trop de requêtes, réessayez dans un instant.', {
      status: 429,
      headers: rateLimit.retryAfterSeconds
        ? { 'Retry-After': String(rateLimit.retryAfterSeconds) }
        : undefined,
    });
  }

  const admin = getAdminClient();
  const access = await getAccessibleChatbot(admin, chatbotId, request);
  if (!access.ok) {
    logWarn('public-chat-files.blocked', { chatbotId, reason: access.reason });
    return new Response('Chatbot introuvable.', { status: 404 });
  }
  const { chatbot } = access;

  if (!chatbot.allow_visitor_uploads) {
    return new Response("L'envoi de fichiers n'est pas activé sur ce chatbot.", { status: 403 });
  }

  const validation = validateVisitorFile(file.name, file.size);
  if (!validation.ok) {
    return new Response(validation.error, { status: 400 });
  }

  const logCtx = { chatbotId: chatbot.id, organizationId: chatbot.organization_id, public: true };

  try {
    let conversationId = conversationIdInput;
    let createdConversation = false;

    if (conversationId) {
      const owned = await getConversationForIdentity(admin, conversationId, {
        chatbotId: chatbot.id,
        visitorId,
      });
      if (!owned) return new Response('Conversation introuvable.', { status: 404 });

      if ((await countConversationFiles(admin, conversationId)) >= MAX_FILES_PER_CONVERSATION) {
        return new Response(
          `Nombre maximum de fichiers atteint pour cette conversation (${MAX_FILES_PER_CONVERSATION}).`,
          { status: 400 }
        );
      }
    } else {
      conversationId = await createConversation(admin, { chatbotId: chatbot.id, visitorId });
      createdConversation = true;
    }

    const data = Buffer.from(await file.arrayBuffer());
    let stored;
    try {
      stored = await storeVisitorFile(admin, {
        organizationId: chatbot.organization_id,
        chatbotId: chatbot.id,
        conversationId,
        filename: file.name,
        contentType: validation.contentType,
        data,
      });
    } catch (err) {
      // Don't leave an empty conversation behind when it was created just for
      // this upload.
      if (createdConversation) {
        await admin.from('conversations').delete().eq('id', conversationId);
      }
      throw err;
    }

    // Reading the file for the chatbot (docs/roadmap.md item 63) is best
    // effort: the file is already stored, so a failure here (unreadable file,
    // OCR down) only means the chatbot will say it couldn't read it.
    let readable: boolean | undefined;
    if (chatbot.analyze_visitor_files) {
      try {
        const extraction = await analyzeVisitorFile(data, file.name, logCtx);
        await saveFileExtraction(admin, stored.file.id, extraction);
        readable = extraction.status === 'ok';
      } catch (err) {
        logWarn('public-chat-files.analysis_failed', {
          ...logCtx,
          conversationId,
          error: err instanceof Error ? err.message : String(err),
        });
        readable = false;
      }
    }

    // Size only, never the filename or content — see the GDPR note in
    // lib/logger.ts.
    logInfo('public-chat-files.stored', { ...logCtx, conversationId, sizeBytes: file.size, readable });
    return Response.json({
      conversationId,
      attachment: stored.file,
      content: stored.content,
      readable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('public-chat-files.failed', { ...logCtx, error: message });
    return new Response(message, { status: 500 });
  }
}
