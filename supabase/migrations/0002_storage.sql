-- ============================================================================
-- Supabase Storage bucket for uploaded source documents.
-- Objects are stored at: {organization_id}/{chatbot_id}/{document_id}-{filename}
-- so RLS can scope access by reading the first path segment.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_bucket_select on storage.objects
  for select using (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy documents_bucket_insert on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy documents_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );
