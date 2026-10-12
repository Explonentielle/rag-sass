-- ============================================================================
-- Visitor file uploads in the chat widget (docs/roadmap.md item 48).
-- Opt-in per chatbot (default off). A file sent by a visitor is stored in a
-- private bucket and attached to the conversation through a regular
-- `messages` row (so history, ordering and retention follow the existing
-- conversation machinery) plus a `conversation_files` row pointing at the
-- storage object. Anonymous visitors never touch this table or the bucket
-- directly: uploads go through app/api/public-chat/files/route.ts, which uses
-- the service-role client. Org members read files through the dashboard.
--
-- Known gap: the pg_cron retention purge (0006) deletes conversations, and the
-- rows here cascade, but Storage objects are not removed by SQL. Explicit
-- deletions (visitor, dashboard, chatbot/org deletion) clean the objects up in
-- application code; the scheduled purge does not yet (see roadmap item 48).
-- ============================================================================

alter table chatbots
  add column if not exists allow_visitor_uploads boolean not null default false;

comment on column chatbots.allow_visitor_uploads is
  'When true, the public chat widget shows a file button and app/api/public-chat/files accepts visitor uploads (lib/visitorFileRules.ts for limits). Files are stored with the conversation and attached to the owner notification email when that tool is enabled.';

-- 4 MiB: Vercel rejects request bodies above 4.5 MB, uploads are proxied
-- through our API route.
insert into storage.buckets (id, name, public, file_size_limit)
values ('conversation-files', 'conversation-files', false, 4194304)
on conflict (id) do nothing;

create table if not exists conversation_files (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots (id) on delete cascade,
  conversation_id uuid not null references conversations (id) on delete cascade,
  message_id uuid not null references messages (id) on delete cascade,
  filename text not null,
  size_bytes integer not null,
  -- {organization_id}/{chatbot_id}/{conversation_id}/{id}-{sanitized filename}
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_files_conversation_idx
  on conversation_files (conversation_id, created_at);
create index if not exists conversation_files_chatbot_idx
  on conversation_files (chatbot_id);

alter table conversation_files enable row level security;

drop policy if exists conversation_files_select on conversation_files;
create policy conversation_files_select on conversation_files
  for select using (
    exists (
      select 1 from chatbots c
      where c.id = conversation_files.chatbot_id and is_org_member(c.organization_id)
    )
  );

-- Bucket access for org members only (first path segment = organization_id,
-- same scheme as the `documents` bucket). No insert policy on purpose:
-- visitors upload through the service-role API route.
drop policy if exists conversation_files_bucket_select on storage.objects;
create policy conversation_files_bucket_select on storage.objects
  for select using (
    bucket_id = 'conversation-files'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists conversation_files_bucket_delete on storage.objects;
create policy conversation_files_bucket_delete on storage.objects
  for delete using (
    bucket_id = 'conversation-files'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );
