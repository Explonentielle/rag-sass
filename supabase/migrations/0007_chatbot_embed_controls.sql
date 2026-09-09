-- ============================================================================
-- Embed access controls for public chatbots (docs/roadmap.md item — domain
-- restriction + "chatbot embeddable" toggle, see docs/integration.md).
-- Both opt-in: default values preserve today's behavior (any chatbot ID
-- reachable from anywhere) so existing pilot embeds keep working until an
-- owner explicitly restricts one.
-- ============================================================================

alter table chatbots
  add column if not exists is_public boolean not null default true,
  add column if not exists allowed_origins text[] not null default '{}';

comment on column chatbots.is_public is
  'When false, /api/public-chat and /embed/[chatbotId] refuse all anonymous access to this chatbot (404), regardless of origin.';
comment on column chatbots.allowed_origins is
  'Origins (scheme://host[:port], no path) allowed to embed/call this chatbot anonymously. Empty = no restriction (any origin).';
