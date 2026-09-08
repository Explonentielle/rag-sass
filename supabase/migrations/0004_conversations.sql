-- ============================================================================
-- Persistent conversation history. The chat was stateless server-side —
-- history lived only in the browser's React state, lost on reload. One
-- conversation per (chatbot, identity): identity is auth.users.id for the
-- authenticated dashboard test-chat, or a client-generated visitor_id
-- (UUID stored in the widget's localStorage) for the anonymous public
-- widget/iframe embed — there's no Supabase session to key on there.
-- ============================================================================

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references chatbots (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  visitor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_identity_check check (
    (user_id is not null and visitor_id is null) or
    (user_id is null and visitor_id is not null)
  )
);

-- One conversation per (chatbot, identity) — lets both the authenticated
-- and public routes "find or create" via a plain upsert (ON CONFLICT on
-- these columns) instead of a select-then-insert race. Plain (non-partial)
-- unique indexes are enough here: Postgres never considers two NULLs equal
-- in a unique index, so rows with user_id/visitor_id NULL never collide —
-- exactly the "only enforce uniqueness for the identity that's actually
-- set" behavior we want, without needing a partial-index WHERE clause
-- (which ON CONFLICT can't target via the Supabase client anyway).
create unique index if not exists conversations_chatbot_user_unique
  on conversations (chatbot_id, user_id);
create unique index if not exists conversations_chatbot_visitor_unique
  on conversations (chatbot_id, visitor_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table messages enable row level security;

-- conversations/messages: same transitively-scoped-via-chatbots pattern as
-- documents. Deliberately not restricted to `user_id = auth.uid()` — any
-- org member can already read/write the chatbots and documents tables, so
-- letting teammates see each other's test conversations is consistent, not
-- a new trust boundary. The public widget never goes through this RLS
-- client at all — app/api/public-chat/route.ts uses the service-role admin
-- client (getAdminClient(), bypasses RLS) for anonymous visitor_id rows,
-- same as it already does for the chatbots lookup.
create policy conversations_select on conversations
  for select using (
    exists (
      select 1 from chatbots c
      where c.id = conversations.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy conversations_insert on conversations
  for insert with check (
    exists (
      select 1 from chatbots c
      where c.id = conversations.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy conversations_update on conversations
  for update using (
    exists (
      select 1 from chatbots c
      where c.id = conversations.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy conversations_delete on conversations
  for delete using (
    exists (
      select 1 from chatbots c
      where c.id = conversations.chatbot_id and is_org_member(c.organization_id)
    )
  );

create policy messages_select on messages
  for select using (
    exists (
      select 1 from conversations conv
      join chatbots c on c.id = conv.chatbot_id
      where conv.id = messages.conversation_id and is_org_member(c.organization_id)
    )
  );

create policy messages_insert on messages
  for insert with check (
    exists (
      select 1 from conversations conv
      join chatbots c on c.id = conv.chatbot_id
      where conv.id = messages.conversation_id and is_org_member(c.organization_id)
    )
  );
