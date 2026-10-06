import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeOrigin } from '@/lib/embedAccess';
import { deleteChatbotChunks } from '@/lib/elasticsearch';
import { AI_INDEXING_ALLOWED_PLANS } from '@/lib/plans';
import { logInfo, logError } from '@/lib/logger';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const systemPromptTemplate: string | undefined = body?.systemPromptTemplate;
  const name: string | undefined = body?.name?.trim();
  const isPublic: boolean | undefined = body?.isPublic;
  const allowedOriginsInput: unknown = body?.allowedOrigins;
  const useDocuments: boolean | undefined = body?.useDocuments;
  const useAiIndexing: boolean | undefined = body?.useAiIndexing;

  let allowedOrigins: string[] | undefined;
  if (allowedOriginsInput !== undefined) {
    if (!Array.isArray(allowedOriginsInput) || !allowedOriginsInput.every((o) => typeof o === 'string')) {
      return NextResponse.json({ error: 'allowedOrigins doit être un tableau de chaînes.' }, { status: 400 });
    }
    const normalized = allowedOriginsInput.map(normalizeOrigin);
    if (normalized.some((o) => o === null)) {
      return NextResponse.json(
        { error: "Un des domaines n'est pas une URL valide (ex. https://exemple.com)." },
        { status: 400 }
      );
    }
    allowedOrigins = Array.from(new Set(normalized as string[]));
  }

  if (
    systemPromptTemplate === undefined &&
    !name &&
    isPublic === undefined &&
    allowedOrigins === undefined &&
    useDocuments === undefined &&
    useAiIndexing === undefined
  ) {
    return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });
  }

  // Premium entitlement (docs/roadmap.md item 18) — only check when
  // actually turning it on, not when leaving/turning it off, so a
  // downgraded org isn't blocked from disabling what it can no longer use.
  if (useAiIndexing) {
    const { data: chatbot } = await supabase
      .from('chatbots')
      .select('organization_id')
      .eq('id', params.id)
      .single();

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', chatbot.organization_id)
      .single();

    if (!org || !AI_INDEXING_ALLOWED_PLANS.includes(org.plan)) {
      return NextResponse.json(
        { error: "L'indexation assistée par IA nécessite le plan PME ou Métier." },
        { status: 403 }
      );
    }
  }

  // RLS (chatbots_update: is_org_member) enforces tenant scoping.
  const { error } = await supabase
    .from('chatbots')
    .update({
      ...(systemPromptTemplate !== undefined ? { system_prompt_template: systemPromptTemplate } : {}),
      ...(name ? { name } : {}),
      ...(isPublic !== undefined ? { is_public: isPublic } : {}),
      ...(allowedOrigins !== undefined ? { allowed_origins: allowedOrigins } : {}),
      ...(useDocuments !== undefined ? { use_documents: useDocuments } : {}),
      ...(useAiIndexing !== undefined ? { use_ai_indexing: useAiIndexing } : {}),
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Deletes a chatbot and everything scoped to it — documents, conversations
 * and messages cascade at the DB level (`on delete cascade`, migration
 * 0001/0004). Two things that cascade does *not* reach, cleaned up
 * explicitly first: the Elasticsearch chunks and the Storage files, both
 * keyed separately from Postgres. `custom_templates` are org-level, not
 * chatbot-level — untouched. RLS (`chatbots_delete`: `is_org_admin`) is the
 * only authorization check — unlike organization deletion, this isn't
 * destructive enough to warrant a stricter owner-only bar on top of it.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS (chatbots_select: is_org_member) scopes this — a chatbot from
  // another tenant simply won't be found.
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, organization_id, name')
    .eq('id', params.id)
    .single();

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('chatbot_id', chatbot.id);

  const storagePaths = (documents ?? []).map((d) => d.storage_path);

  try {
    await deleteChatbotChunks(chatbot.id);
  } catch (err) {
    // Don't block the deletion on an ES hiccup — better to finish removing
    // the chatbot than leave it half-deleted. Logged so orphaned chunks
    // (now unreachable — no chatbot left to scope a search to) can be
    // traced and cleaned up later if it ever matters.
    logError('chatbot.delete_es_failed', {
      chatbotId: chatbot.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from('documents').remove(storagePaths);
    if (storageError) {
      logError('chatbot.delete_storage_failed', {
        chatbotId: chatbot.id,
        error: storageError.message,
        fileCount: storagePaths.length,
      });
    }
  }

  // RLS (chatbots_delete: is_org_admin) enforces that only an org
  // admin/owner can reach this — a plain member's request fails here.
  const { error: deleteError } = await supabase.from('chatbots').delete().eq('id', chatbot.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  logInfo('chatbot.deleted', {
    chatbotId: chatbot.id,
    organizationId: chatbot.organization_id,
    documentCount: storagePaths.length,
  });
  return NextResponse.json({ ok: true });
}
