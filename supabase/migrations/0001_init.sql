-- ============================================================================
-- RAG SaaS: initial multi-tenant schema
-- ============================================================================
-- Tenancy model: one "organization" = one client. Users belong to
-- organizations via users_organizations (many-to-many, with a role).
-- Every other table hangs off organization_id (directly or via chatbot_id)
-- so RLS can scope all reads/writes to the caller's organizations.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- users_organizations: links auth.users to organizations with a role.
-- No separate "users" table: Supabase Auth's auth.users is the source of
-- truth for identity; this table only adds the tenancy + role relationship.
-- ----------------------------------------------------------------------------
create table if not exists users_organizations (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create index if not exists users_organizations_org_idx on users_organizations (organization_id);

-- ----------------------------------------------------------------------------
-- chatbots: an organization can run several bots (e.g. one per use case).
-- ----------------------------------------------------------------------------
create table if not exists chatbots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  system_prompt_template text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists chatbots_org_idx on chatbots (organization_id);

-- ----------------------------------------------------------------------------
-- documents: one row per uploaded file; indexing status tracked here while
-- the actual chunks/embeddings live in Elasticsearch.
-- ----------------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots (id) on delete cascade,
  filename text not null,
  file_type text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'indexed', 'error')),
  error_message text,
  chunk_count integer,
  uploaded_at timestamptz not null default now(),
  indexed_at timestamptz
);

create index if not exists documents_chatbot_idx on documents (chatbot_id);

-- ============================================================================
-- Helper functions
-- ============================================================================

-- True if the current auth user belongs to the given organization.
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users_organizations uo
    where uo.organization_id = org_id
      and uo.user_id = auth.uid()
  );
$$;

-- True if the current auth user is an owner/admin of the given organization.
create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users_organizations uo
    where uo.organization_id = org_id
      and uo.user_id = auth.uid()
      and uo.role in ('owner', 'admin')
  );
$$;

-- Creates an organization and makes the caller its owner in one transaction.
-- Runs as SECURITY DEFINER so it can insert into organizations (which has no
-- direct INSERT policy for regular users) and users_organizations atomically.
create or replace function create_organization(org_name text)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org organizations;
begin
  insert into organizations (name) values (org_name) returning * into new_org;

  insert into users_organizations (user_id, organization_id, role)
  values (auth.uid(), new_org.id, 'owner');

  return new_org;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table organizations enable row level security;
alter table users_organizations enable row level security;
alter table chatbots enable row level security;
alter table documents enable row level security;

-- organizations: members can see their org; no direct insert (use
-- create_organization()); owners/admins can update/delete.
create policy organizations_select on organizations
  for select using (is_org_member(id));

create policy organizations_update on organizations
  for update using (is_org_admin(id));

create policy organizations_delete on organizations
  for delete using (is_org_admin(id));

-- users_organizations: members can see the membership rows of orgs they
-- belong to (so they can see teammates); owners/admins manage membership.
create policy users_organizations_select on users_organizations
  for select using (is_org_member(organization_id));

create policy users_organizations_insert on users_organizations
  for insert with check (is_org_admin(organization_id));

create policy users_organizations_update on users_organizations
  for update using (is_org_admin(organization_id));

create policy users_organizations_delete on users_organizations
  for delete using (is_org_admin(organization_id));

-- chatbots: any org member can read/create/edit; kept simple for the MVP
-- (role gating can be tightened to admins-only once billing/roles matter).
create policy chatbots_select on chatbots
  for select using (is_org_member(organization_id));

create policy chatbots_insert on chatbots
  for insert with check (is_org_member(organization_id));

create policy chatbots_update on chatbots
  for update using (is_org_member(organization_id));

create policy chatbots_delete on chatbots
  for delete using (is_org_admin(organization_id));

-- documents: scoped transitively through chatbots.organization_id.
create policy documents_select on documents
  for select using (
    exists (
      select 1 from chatbots c
      where c.id = documents.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy documents_insert on documents
  for insert with check (
    exists (
      select 1 from chatbots c
      where c.id = documents.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy documents_update on documents
  for update using (
    exists (
      select 1 from chatbots c
      where c.id = documents.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy documents_delete on documents
  for delete using (
    exists (
      select 1 from chatbots c
      where c.id = documents.chatbot_id and is_org_member(c.organization_id)
    )
  );
