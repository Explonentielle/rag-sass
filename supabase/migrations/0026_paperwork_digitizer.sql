-- ============================================================================
-- Digitaliseur de paperasse (docs/roadmap.md item 24), premium PME/Métier.
-- Reuses chatbots/documents comme l'analyseur de contrats (item 23), mais à
-- l'inverse : liste accumulée, pas un document isolé. Un digitaliseur
-- (chatbot use_case='paperwork_digitizer') peut recevoir plusieurs documents
-- au fil du temps ; chacun est digitalisé individuellement
-- (documents.extracted_fields), il n'y a pas de résumé unique sur le
-- chatbot comme chatbots.contract_summary.
--
-- document_format : format choisi par le propriétaire à la création,
-- utilisé pour orienter l'extraction (lib/openai.ts extractDocumentFields) :
-- 'facture' = schéma de champs attendus pour une facture ; 'libre' = le
-- modèle identifie lui-même les paires clé/valeur pertinentes.
-- ============================================================================

alter table chatbots
  drop constraint if exists chatbots_use_case_check;

alter table chatbots
  add constraint chatbots_use_case_check
  check (use_case in ('site_widget', 'second_cerveau', 'contract_analyzer', 'paperwork_digitizer'));

alter table chatbots
  add column if not exists document_format text;

alter table chatbots
  add constraint chatbots_document_format_check
  check (document_format is null or document_format in ('facture', 'libre'));

alter table documents
  add column if not exists extracted_fields jsonb;
