-- ============================================================================
-- Agent de qualification de leads (docs/roadmap.md item 21) : capacité
-- ajoutée aux chatbots existants (toggle dédié), pas un nouveau use_case ni
-- une section dashboard séparée comme l'analyseur de contrats (item 23) —
-- le lead qualifié reste dans la conversation widget normale.
--
-- allow_lead_qualification : active la qualification active + le routage.
-- lead_qualification_criteria : critères libres du propriétaire (ex. budget
-- mini, zone, délai) injectés dans le prompt ; null = critères génériques.
-- meeting_link : lien de RDV (Calendly ou autre) partagé par le bot quand il
-- juge le lead "chaud" ; null = pas de lien partagé.
-- ============================================================================

alter table chatbots
  add column allow_lead_qualification boolean not null default false,
  add column lead_qualification_criteria text,
  add column meeting_link text;
