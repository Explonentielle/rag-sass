# Gestion des comptes et des accès : Volcanic Cloud

## Authentification unique (SSO)

L'authentification unique (SSO, SAML/OAuth) est disponible à partir du
palier Pro, en option payante à 49€ par mois. Elle est incluse sans
supplément pour le palier Enterprise. Elle n'est pas disponible du tout
sur le palier Starter.

## Rôles et permissions

Trois rôles standards existent sur tous les paliers : Administrateur,
Éditeur et Lecteur. Les rôles personnalisés, avec des permissions
granulaires définies par le client, ne sont disponibles que sur le
palier Enterprise.

## Suspension pour non-paiement

En cas de retard de paiement, l'accès au compte évolue par étapes :
après 3 jours de retard, le compte passe en lecture seule (plus aucune
modification possible). Après 14 jours de retard, l'accès est totalement
suspendu. Après 60 jours de retard, le compte est résilié définitivement
et ses données sont purgées selon la politique de rétention applicable à
son palier.

## Limites d'appels API

Le palier Starter est limité à 1 000 appels API par heure, le palier Pro
à 10 000 appels API par heure. Le palier Enterprise négocie sa propre
limite au contrat. En cas de dépassement, les requêtes excédentaires sont
mises en attente (throttling) plutôt que facturées en supplément, sauf
accord spécifique négocié pour un compte Enterprise.

## Export des données à la clôture du compte

Pendant toute la durée de la période de rétention post-résiliation (voir
le document sécurité et conformité), un export des données reste
disponible aux formats CSV ou JSON. Un premier export est gratuit ; tout
export supplémentaire réalisé avec l'assistance d'un technicien est
facturé 200€.
