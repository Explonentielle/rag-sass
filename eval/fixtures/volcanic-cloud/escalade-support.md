# Escalade support : Volcanic Cloud

Chaque ticket de support est classé selon un niveau de sévérité, qui
détermine le délai de première réponse garanti et le chemin
d'escalade.

## Niveaux de sévérité

- **P1** : service totalement indisponible pour le client.
- **P2** : fonctionnalité majeure dégradée, mais le service reste
  globalement utilisable.
- **P3** : bug mineur, sans impact bloquant sur l'activité du client.
- **P4** : question d'utilisation ou demande d'évolution.

## Délais de première réponse par palier

Sur le palier Starter : P1 sous 4 heures, P2 sous 8 heures, P3 sous 2
jours ouvrés, P4 sous 5 jours ouvrés.

Sur le palier Pro : P1 sous 1 heure, P2 sous 4 heures, P3 sous 1 jour
ouvré, P4 sous 3 jours ouvrés.

Sur le palier Enterprise : P1 sous 15 minutes, P2 sous 1 heure, P3 sous 4
heures, P4 sous 1 jour ouvré. Une astreinte 24h/24 et 7j/7 est incluse
pour les tickets P1 et P2 sur ce palier.

## Escalade automatique

Un ticket P1 non résolu à l'expiration de son délai de première réponse
est automatiquement escaladé au niveau 2 (équipe ingénierie). Si un
ticket P1 reste ouvert plus de 2 heures sur les paliers Pro et Enterprise,
ou plus de 8 heures sur le palier Starter, l'astreinte on-call est
déclenchée automatiquement, même en dehors des heures ouvrées.

## Reclassification de sévérité

Le support est habilité à rétrograder un ticket initialement marqué P1
par le client s'il constate que le service reste globalement disponible
(par exemple, un seul utilisateur affecté sur l'ensemble du compte). Toute
reclassification doit être accompagnée d'une justification écrite
envoyée au client.

## Couverture week-end et jours fériés

Le week-end et les jours fériés, seul le traitement des tickets P1 est
garanti pour les paliers Starter et Pro. Le palier Enterprise bénéficie
d'une couverture étendue aux tickets P1 et P2 pendant ces périodes.
