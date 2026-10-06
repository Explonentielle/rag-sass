-- ============================================================================
-- URL ingestion (docs/roadmap.md item 18, point 5) — a document can now
-- come from a scraped URL instead of an uploaded file. storage_path only
-- makes sense for an uploaded file (a real Supabase Storage object), so it
-- becomes nullable; source_url is its URL-sourced counterpart. Exactly one
-- of the two is set in practice (enforced in application code, not a DB
-- constraint — keeps this migration additive/simple).
-- ============================================================================

alter table documents
  alter column storage_path drop not null,
  add column if not exists source_url text;

comment on column documents.storage_path is
  'Supabase Storage path for an uploaded file. Null for a URL-sourced document (see source_url).';
comment on column documents.source_url is
  'Source URL for a scraped document (file_type = ''url''). Null for an uploaded file (see storage_path).';
