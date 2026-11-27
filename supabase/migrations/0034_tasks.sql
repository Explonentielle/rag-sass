-- ============================================================================
-- Todolist extraite automatiquement des enregistrements audio (docs/
-- roadmap.md item 72) : pour un chatbot use_case = 'second_cerveau', chaque
-- enregistrement transcrit (item 46) passe aussi par une extraction de
-- tâches (lib/openai.ts extractTasksFromText), et les tâches trouvées sont
-- stockées ici plutôt que seulement indexées comme texte libre.
--
-- Scopée transitivement via chatbot_id (comme `documents`), pas de colonne
-- organization_id dédiée : même convention que le reste du schéma.
-- ============================================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots (id) on delete cascade,
  document_id uuid references documents (id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_chatbot_idx on tasks (chatbot_id);
create index if not exists tasks_due_date_idx on tasks (due_date) where status = 'pending';

alter table tasks enable row level security;

create policy tasks_select on tasks
  for select using (
    exists (
      select 1 from chatbots c
      where c.id = tasks.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy tasks_insert on tasks
  for insert with check (
    exists (
      select 1 from chatbots c
      where c.id = tasks.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy tasks_update on tasks
  for update using (
    exists (
      select 1 from chatbots c
      where c.id = tasks.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy tasks_delete on tasks
  for delete using (
    exists (
      select 1 from chatbots c
      where c.id = tasks.chatbot_id and is_org_member(c.organization_id)
    )
  );
