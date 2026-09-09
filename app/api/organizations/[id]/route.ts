import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteOrganizationChunks } from '@/lib/elasticsearch';
import { logInfo, logError } from '@/lib/logger';

/**
 * Deletes an organization and everything in it — chatbots, documents,
 * conversations, messages, custom templates, memberships all cascade at
 * the DB level (`on delete cascade`, migration 0001). Two things the
 * database cascade does *not* reach, cleaned up explicitly first: the
 * Elasticsearch chunk index and Supabase Storage files, both keyed
 * separately from Postgres.
 *
 * Owner-only (stricter than the `organizations_delete` RLS policy, which
 * also allows admin) — deleting an entire organization is destructive
 * enough to warrant the highest bar available, not just "can administer".
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('users_organizations')
    .select('role')
    .eq('organization_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membership?.role !== 'owner') {
    return NextResponse.json(
      { error: "Seul le propriétaire peut supprimer l'organisation." },
      { status: 403 }
    );
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('storage_path, chatbots!inner(organization_id)')
    .eq('chatbots.organization_id', params.id);

  const storagePaths = (documents ?? []).map((d) => d.storage_path);

  try {
    await deleteOrganizationChunks(params.id);
  } catch (err) {
    // Don't block the deletion on an ES hiccup — better to finish removing
    // the org than leave it half-deleted. Logged so orphaned chunks (now
    // unreachable — no chatbot/org left to scope a search to) can be
    // traced and cleaned up later if it ever matters.
    logError('organization.delete_es_failed', {
      organizationId: params.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from('documents').remove(storagePaths);
    if (storageError) {
      logError('organization.delete_storage_failed', {
        organizationId: params.id,
        error: storageError.message,
        fileCount: storagePaths.length,
      });
    }
  }

  const { error: deleteError } = await supabase.from('organizations').delete().eq('id', params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  logInfo('organization.deleted', { organizationId: params.id, documentCount: storagePaths.length });
  return NextResponse.json({ ok: true });
}
