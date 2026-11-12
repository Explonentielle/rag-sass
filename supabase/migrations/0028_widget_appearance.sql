-- ============================================================================
-- Personnalisation du widget public (roadmap item 60).
--
-- bot_name            : nom affiché dans l'en-tête du widget.
-- welcome_message     : premier message affiché avant toute question.
-- suggested_questions : questions cliquables proposées au visiteur (max 4,
--                       validé côté API).
-- logo_path           : chemin du logo dans le bucket `chatbot-logos`.
--
-- Le bucket est PUBLIC en lecture (le logo s'affiche sur le site du client,
-- sans session). Aucune policy d'insertion/suppression : seules les routes
-- API (client service-role, après vérification de l'appartenance à
-- l'organisation) écrivent dedans. 512 Ko et PNG/JPEG/WebP seulement ; le SVG
-- est volontairement exclu.
-- ============================================================================

alter table chatbots
  add column if not exists bot_name text,
  add column if not exists welcome_message text,
  add column if not exists suggested_questions text[],
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chatbot-logos',
  'chatbot-logos',
  true,
  524288,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
