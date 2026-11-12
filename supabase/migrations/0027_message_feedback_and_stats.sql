-- ============================================================================
-- Retour 👍/👎 sur les réponses + statistiques par chatbot (roadmap item 59).
--
-- feedback   : note donnée par l'interlocuteur à une réponse de l'assistant
--              (1 = utile, -1 = pas utile, NULL = pas de retour). Ne porte
--              que sur les lignes role = 'assistant'.
-- no_context : la recherche documentaire n'a rien remonté pour cette question
--              (chatbot avec documents, zéro extrait pertinent) — c'est le
--              signal "le bot n'a rien trouvé" des statistiques.
--
-- chatbot_stats_messages(...) lit les messages d'un chatbot sur une période
-- avec une seule requête. SECURITY INVOKER : la RLS de `messages` /
-- `conversations` s'applique, un membre ne voit que les chatbots de son org.
-- ============================================================================

alter table messages add column if not exists feedback smallint
  check (feedback in (-1, 1));
alter table messages add column if not exists no_context boolean not null default false;

create or replace function chatbot_stats_messages(
  p_chatbot_id uuid,
  p_since timestamptz,
  p_visitors_only boolean,
  p_limit integer default 6000
)
returns table (
  id uuid,
  conversation_id uuid,
  role text,
  content text,
  no_context boolean,
  feedback smallint,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.conversation_id, m.role, m.content, m.no_context, m.feedback, m.created_at
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.chatbot_id = p_chatbot_id
    and m.created_at >= p_since
    and (not p_visitors_only or c.visitor_id is not null)
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 20000)
$$;
