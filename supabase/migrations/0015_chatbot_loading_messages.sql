-- ============================================================================
-- Custom loading-indicator messages (docs/roadmap.md item 47). Per-chatbot,
-- same granularity as everything else chatbot-level. Null/empty = use the
-- app's built-in default rotation (lib/loadingMessages.ts) rather than
-- duplicating that default into every row at creation time.
-- ============================================================================

alter table chatbots
  add column if not exists loading_messages text[];

comment on column chatbots.loading_messages is
  'Custom messages cycled through while the chat answer streams in (components/ChatWidget.tsx), e.g. ["Je réfléchis...", "Un instant..."]. Null or empty = fall back to lib/loadingMessages.ts DEFAULT_LOADING_MESSAGES.';
