-- ============================================================================
-- Loading indicator mode (docs/roadmap.md item 51). Per chatbot, the widget
-- shows either the rotating custom messages (loading_messages, item 47 — the
-- default, so existing chatbots don't change) or the real progress steps the
-- chat routes stream ("searching <topic>", then "writing").
-- ============================================================================

alter table chatbots
  add column if not exists show_loading_steps boolean not null default false;

comment on column chatbots.show_loading_steps is
  'When true, the chat widget shows the real progress steps sent by the chat routes (status SSE events) instead of rotating loading_messages. Prompt-only chatbots have no search step and fall back to loading_messages until writing starts.';
