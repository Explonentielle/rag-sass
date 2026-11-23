-- ============================================================================
-- Fusionne contract_analyzer dans paperwork_digitizer (docs/roadmap.md item
-- 70): ce que la landing appelle "Analyseur de documents" depuis l'item 69
-- correspondait encore à deux use_case distincts en interne. Un contrat
-- devient un digitaliseur dont document_format = 'contrat' (toujours limité
-- à un seul document par analyse, app/api/documents/upload/route.ts,
-- mais ce n'est plus qu'une règle par format, pas un use_case à part).
--
-- Ordre important : le backfill de documents.extracted_fields (étape 2) lit
-- chatbots.use_case = 'contract_analyzer', donc il doit tourner avant la
-- mise à jour des lignes (étape 3) et avant que la contrainte ne retire
-- cette valeur (étape 4). Idempotent comme les migrations précédentes : sur
-- une deuxième exécution, plus aucune ligne n'a use_case = 'contract_analyzer',
-- donc les étapes 2 et 3 ne font rien.
-- ============================================================================

-- 1. Élargit document_format pour accueillir le format contrat.
alter table chatbots
  drop constraint if exists chatbots_document_format_check;

alter table chatbots
  add constraint chatbots_document_format_check
  check (
    document_format is null or document_format in (
      'facture', 'devis', 'bon_commande', 'bon_livraison', 'note_frais', 'fiche_paie', 'contrat', 'libre'
    )
  );

-- 2. Convertit l'ancien résumé de contrat (chatbots.contract_summary, 9
-- champs fixes) en paires label/valeur sur son unique document, dans le
-- même format que extractDocumentFields (lib/openai.ts). Les clauses
-- optionnelles nulles (pas de clause de ce type dans le contrat) sont
-- omises plutôt que remplies à "Non précisé", qui a un sens différent
-- (information absente du document plutôt qu'inexistante).
update documents d
set extracted_fields = (
  select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value))
  from (
    values
      ('Parties', c.contract_summary->>'parties'),
      ('Objet', c.contract_summary->>'objet'),
      ('Durée et reconduction', c.contract_summary->>'dureeEtReconduction'),
      ('Conditions de résiliation', c.contract_summary->>'conditionsResiliation'),
      ('Pénalités', c.contract_summary->>'penalites'),
      ('Modalités de paiement', c.contract_summary->>'modalitesPaiement'),
      ('Clause de confidentialité', c.contract_summary->>'clauseConfidentialite'),
      ('Clause de non-concurrence', c.contract_summary->>'clauseNonConcurrence'),
      ('Points notables', c.contract_summary->>'pointsNotables')
  ) as f(label, value)
  where f.value is not null
)
from chatbots c
where d.chatbot_id = c.id
  and c.use_case = 'contract_analyzer'
  and c.contract_summary is not null
  and d.extracted_fields is null;

-- 3. Bascule chaque chatbot contract_analyzer sur paperwork_digitizer.
update chatbots
set use_case = 'paperwork_digitizer', document_format = 'contrat'
where use_case = 'contract_analyzer';

-- 4. Retire contract_analyzer des valeurs acceptées.
alter table chatbots
  drop constraint if exists chatbots_use_case_check;

alter table chatbots
  add constraint chatbots_use_case_check
  check (use_case in ('site_widget', 'second_cerveau', 'paperwork_digitizer'));

-- 5. contract_summary n'est plus écrit par personne (sa donnée a été
-- recopiée vers documents.extracted_fields à l'étape 2) : colonne retirée
-- plutôt que laissée mourir en silence.
alter table chatbots
  drop column if exists contract_summary;
