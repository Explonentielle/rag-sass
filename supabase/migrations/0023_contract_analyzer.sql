-- ============================================================================
-- Analyseur de contrats (docs/roadmap.md item 23), premium PME/Métier.
-- Reuses the chatbots/documents/chunks infrastructure: a contract analysis
-- is a chatbot with use_case='contract_analyzer', capped to exactly one
-- document (enforced in app/api/documents/upload/route.ts, not here — no
-- cheap DB-level way to cap "at most one row in another table").
-- contract_summary holds the structured clause extraction (lib/openai.ts
-- extractContractClauses), set once ingestion finishes; null until then or
-- if the extraction call failed (best-effort, chat Q&A still works off the
-- indexed chunks regardless).
-- ============================================================================

alter table chatbots
  drop constraint if exists chatbots_use_case_check;

alter table chatbots
  add constraint chatbots_use_case_check
  check (use_case in ('site_widget', 'second_cerveau', 'contract_analyzer'));

alter table chatbots
  add column if not exists contract_summary jsonb;
