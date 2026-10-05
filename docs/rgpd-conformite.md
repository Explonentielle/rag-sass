# Conformité RGPD — items 20-E et 20-F (roadmap)

Les parties A-D de l'item 20 (rétention/purge, suppression à la demande,
chiffrement, logs) sont implémentées côté code — voir `docs/roadmap.md`
item 20. Ce document couvre les deux parties "hors code" qui restaient
ouvertes : E (sous-traitants) et F (documentation/gabarits).

**Ceci n'est pas un avis juridique.** C'est un brouillon de travail pour
aller vite sur un pilote — à faire relire par un professionnel du droit
avant tout usage avec de vrais clients payants, en particulier si leurs
visiteurs sont des particuliers (RGPD art. 28 pour la relation
sous-traitant/responsable de traitement).

---

## E. Sous-traitants tiers

Corpus.ai (le produit) agit comme **sous-traitant** pour le compte de
chaque client pilote (le **responsable de traitement** pour les données
de ses propres visiteurs/clients). Corpus.ai fait lui-même appel à des
sous-traitants ultérieurs :

| Sous-traitant | Rôle | Données concernées | Localisation |
|---|---|---|---|
| **Supabase** | Base de données, authentification, stockage de fichiers | Comptes utilisateurs, documents uploadés, conversations (chiffrées) | À vérifier dans le dashboard Supabase (Project Settings → General → Region) — préférer une région UE si ce n'est pas déjà le cas |
| **OpenAI** | Génération d'embeddings et de réponses de chat | Contenu des questions/réponses et extraits de documents, envoyés à l'API à chaque requête | Hors UE (US) — OpenAI n'entraîne pas ses modèles sur les données envoyées via l'API par défaut, mais le **transfert** des données hors UE doit être documenté et couvert par les clauses contractuelles types (CCT) d'OpenAI (disponibles dans leur Data Processing Addendum) |
| **Elasticsearch** | Index de recherche (chunks de texte + vecteurs) | Contenu des documents indexés | Sous contrôle direct — auto-hébergé sur un VPS choisi par Corpus.ai, donc région maîtrisée directement (voir `docs/deployment.md`) |
| **Vercel** | Hébergement de l'application | Aucune donnée persistée côté Vercel (stateless, les données vivent dans Supabase/ES) — logs d'infra possibles | À vérifier selon la région de déploiement choisie |

**À faire avant le premier client pilote réel** :
- Confirmer/choisir la région Supabase (UE si possible).
- Télécharger le Data Processing Addendum d'OpenAI (disponible sur leur
  site, signature électronique standard) — le conserver comme preuve de
  conformité pour le registre de traitement.
- Documenter l'IP/région du VPS Elasticsearch.

---

## F. Documentation à produire

### F.1 — Registre de traitement minimal

Un tableau simple à tenir à jour (ex. dans ce fichier, ou un tableur) :

| Traitement | Finalité | Données | Base légale | Durée de conservation | Qui y a accès |
|---|---|---|---|---|---|
| Compte utilisateur Corpus.ai | Fournir le service aux clients pilotes | Email, mot de passe (géré par Supabase Auth) | Exécution du contrat | Durée du compte | Équipe Corpus.ai (admin technique) |
| Conversations du chatbot | Fournir des réponses pertinentes au visiteur du client | Questions posées, réponses générées, extraits de documents cités | Intérêt légitime du client (support/vente) | 90 jours (purge automatique, voir item 20-A) | Le client (son équipe), Corpus.ai (support technique) |
| Documents uploadés | Alimenter la base de connaissance du chatbot | Contenu des documents fournis par le client | Exécution du contrat | Durée du chatbot actif | Le client, Corpus.ai (support technique) |

### F.2 — Mention à afficher aux visiteurs du widget public

Gabarit fourni par Corpus.ai, à adapter et afficher par **le client** sur
son propre site (à proximité du widget, ou dans sa politique de
confidentialité) :

> *Ce site utilise un assistant conversationnel propulsé par Corpus.ai.
> Les questions que vous posez et les réponses générées sont traitées
> pour vous fournir une réponse pertinente, et conservées pendant 90 jours
> maximum. Elles peuvent être transmises à des prestataires techniques
> (hébergement, génération de réponse par intelligence artificielle) dans
> le cadre strict de ce traitement. Vous pouvez demander la suppression
> de votre historique de conversation en contactant [CLIENT — à
> compléter].*

### F.3 — Gabarit de DPA (Data Processing Agreement) client

Points clés à couvrir dans le DPA signé avec chaque client pilote
(Corpus.ai = sous-traitant, client = responsable de traitement) —
squelette, pas un contrat prêt à signer :

1. **Objet** : traitement de données à caractère personnel des visiteurs
   du client dans le cadre du service de chatbot Corpus.ai.
2. **Durée** : alignée sur la durée du contrat commercial.
3. **Nature et finalité du traitement** : hébergement et traitement des
   conversations/documents pour fournir le service de chatbot.
4. **Catégories de données** : contenu des questions/réponses, documents
   fournis par le client, métadonnées techniques (horodatage, identifiant
   visiteur anonyme).
5. **Sous-traitants ultérieurs** : lister Supabase, OpenAI, le VPS
   Elasticsearch (voir tableau E ci-dessus) — obligation d'information
   préalable en cas de changement.
6. **Sécurité** : chiffrement applicatif des messages (AES-256-GCM),
   isolation multi-tenant par organisation (RLS Postgres + filtre
   applicatif Elasticsearch), purge automatique après 90 jours.
7. **Droits des personnes concernées** : procédure de suppression à la
   demande (voir item 20-B, panneau de gestion des conversations côté
   client).
8. **Notification de violation de données** : délai d'information du
   client en cas d'incident (généralement 48-72h, à négocier).
9. **Sort des données en fin de contrat** : suppression ou restitution,
   délai.

**À faire avant le premier client pilote payant** : faire relire ce
squelette par un professionnel du droit, et le transformer en document
signable (ex. via une signature électronique simple).
