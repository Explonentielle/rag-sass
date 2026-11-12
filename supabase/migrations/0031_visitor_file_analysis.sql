-- ============================================================================
-- Lecture par l'IA des fichiers envoyés par les visiteurs (roadmap item 63,
-- ex-item 49).
--
-- chatbots.analyze_visitor_files : le chatbot lit le contenu des fichiers que
--     le visiteur joint (désactivé par défaut ; n'a d'effet que si l'envoi de
--     fichiers, item 48, est activé).
-- conversation_files.extracted_text : texte extrait du fichier, CHIFFRÉ par
--     l'application comme les messages (lib/crypto.ts). Supprimé avec le
--     fichier, donc avec la conversation (cascade) et la purge de rétention.
-- conversation_files.extraction_status : 'ok', 'empty' (rien de lisible) ou
--     'failed' (lecture impossible) ; NULL tant que le fichier n'a pas été lu
--     ou si l'option est désactivée.
-- conversation_files.extraction_truncated : le texte a été coupé à la limite.
-- ============================================================================

alter table chatbots
  add column if not exists analyze_visitor_files boolean not null default false;

alter table conversation_files
  add column if not exists extracted_text text,
  add column if not exists extraction_status text
    check (extraction_status in ('ok', 'empty', 'failed')),
  add column if not exists extraction_truncated boolean not null default false;
