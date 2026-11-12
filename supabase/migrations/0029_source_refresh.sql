-- ============================================================================
-- Mise à jour automatique des pages web indexées (roadmap item 61).
--
-- chatbots.source_refresh : fréquence de re-lecture des documents d'origine
--                           URL de ce chatbot ('off' par défaut).
-- documents.content_hash  : empreinte SHA-256 du texte extrait lors de la
--                           dernière indexation réussie. Sert à ne ré-indexer
--                           (donc à ne payer les embeddings) que si la page a
--                           réellement changé.
-- documents.last_checked_at : dernière lecture de la page, changée ou non.
-- ============================================================================

alter table chatbots
  add column if not exists source_refresh text not null default 'off'
    check (source_refresh in ('off', 'daily', 'weekly'));

alter table documents
  add column if not exists content_hash text,
  add column if not exists last_checked_at timestamptz;

create index if not exists documents_url_refresh_idx
  on documents (last_checked_at nulls first)
  where file_type = 'url';
