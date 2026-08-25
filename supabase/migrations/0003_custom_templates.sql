-- ============================================================================
-- Custom prompt templates: org-owned, reusable system prompt starting points,
-- distinct from the hard-coded defaults in lib/prompts.ts. Lets a user save a
-- prompt they've tuned for one chatbot and reuse it on another, without
-- retyping it.
-- ============================================================================

create table if not exists custom_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  label text not null,
  template text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_templates_org_idx on custom_templates (organization_id);

alter table custom_templates enable row level security;

-- Same scoping pattern as chatbots: any org member can read/create/edit,
-- only owners/admins can delete.
create policy custom_templates_select on custom_templates
  for select using (is_org_member(organization_id));

create policy custom_templates_insert on custom_templates
  for insert with check (is_org_member(organization_id));

create policy custom_templates_update on custom_templates
  for update using (is_org_member(organization_id));

create policy custom_templates_delete on custom_templates
  for delete using (is_org_admin(organization_id));
