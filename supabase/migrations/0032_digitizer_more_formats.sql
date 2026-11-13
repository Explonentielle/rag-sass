-- ============================================================================
-- Digitaliseur de paperasse (docs/roadmap.md item 24) : élargit les formats
-- disponibles au-delà de 'facture'/'libre'. Chaque nouveau format a son
-- propre schéma de champs attendus dans lib/openai.ts
-- (DOCUMENT_FIELDS_SYSTEM_PROMPTS), pas de logique différente côté SQL.
--
-- 'fiche_paie' : donnée personnelle sensible (RGPD, salaire) — pas de
-- contrainte technique différente ici, le garde-fou est dans le prompt
-- d'extraction (n'extrait que les champs listés, rien de plus) et dans
-- l'avertissement affiché à la création (components/CreateDigitizerForm.tsx).
-- ============================================================================

alter table chatbots
  drop constraint if exists chatbots_document_format_check;

alter table chatbots
  add constraint chatbots_document_format_check
  check (
    document_format is null or document_format in (
      'facture', 'devis', 'bon_commande', 'bon_livraison', 'note_frais', 'fiche_paie', 'libre'
    )
  );
