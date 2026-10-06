-- ============================================================================
-- AI-assisted indexing, premium feature (docs/roadmap.md item 18, section
-- 0). Per-chatbot flag, same granularity as use_documents/is_public — a
-- client might only need it on one chatbot with messy source documents.
-- Gated by plan at the application layer (lib/plans.ts
-- AI_INDEXING_ALLOWED_PLANS), not by a DB constraint: the plan itself
-- isn't billing-enforced yet either (item 17), same soft-gate philosophy.
-- ============================================================================

alter table chatbots
  add column if not exists use_ai_indexing boolean not null default false;

comment on column chatbots.use_ai_indexing is
  'When true, document ingestion (lib/ingest.ts) uses an LLM pass (lib/openai.ts structureChunksWithAI) to clean and segment the extracted text instead of the mechanical chunker (lib/chunking.ts). Falls back to the mechanical chunker on any failure. Requires the organization''s plan to be in AI_INDEXING_ALLOWED_PLANS (lib/plans.ts), enforced in app/api/chatbots/[id]/route.ts.';
