-- ============================================================================
-- "Prompt-only" chatbot mode (docs/roadmap.md item 23). Until now, every
-- chatbot's system prompt forced "answer STRICTLY from the retrieved
-- documents" — a chatbot with zero indexed documents could never answer
-- anything, even a trivial FAQ the owner could have just typed into the
-- prompt (e.g. a small business/artisan who wants a simple site FAQ bot
-- with no document to upload at all).
-- ============================================================================

alter table chatbots
  add column if not exists use_documents boolean not null default true;

comment on column chatbots.use_documents is
  'When true (default, current behavior): answers are grounded strictly in retrieved document chunks, hybridSearch runs on every message. When false: no retrieval at all, the system_prompt_template alone is sent to the model as-is (no document wrapper) — for chatbots with no documents, whose entire "knowledge" is written directly into the prompt.';
