-- ============================================================================
-- Agentic email tool opt-in (docs/roadmap.md item 33, first agentic tool).
-- Per-chatbot, same granularity as use_documents/use_ai_indexing — an org
-- shouldn't have their chatbot start sending emails on their visitors'
-- behalf without explicitly turning it on.
-- ============================================================================

alter table chatbots
  add column if not exists allow_email_tool boolean not null default false;

comment on column chatbots.allow_email_tool is
  'When true, the chat LLM may call the send_follow_up_email tool (lib/agenticTools.ts) mid-answer. Requires RESEND_API_KEY to actually send (lib/email.ts) -- the tool itself reports a clean failure to the model if that''s missing.';
