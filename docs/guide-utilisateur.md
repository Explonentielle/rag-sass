# Guide utilisateur : Corpus.ai

Ce document explique comment utiliser Corpus.ai : créer un compte, configurer
un chatbot, y ajouter vos documents, et l'intégrer sur votre propre site web.

## 1. Qu'est-ce que Corpus.ai ?

Corpus.ai permet de créer un chatbot qui répond uniquement à partir des
documents que vous lui fournissez (scripts de vente, procédures, FAQ...). Il
ne répond jamais en inventant : si l'information n'est pas dans vos
documents, il le dit clairement. Chaque réponse cite les documents utilisés
comme source.

## 2. Créer un compte

1. Allez sur la page d'inscription (`/signup`).
2. Renseignez le nom de votre entreprise, votre email et un mot de passe.
3. Une organisation est créée automatiquement pour vous, avec le rôle
   Propriétaire.
4. Selon la configuration, une confirmation par email peut être nécessaire
   avant la première connexion.

## 3. Le tableau de bord

Une fois connecté, vous arrivez sur le dashboard. La barre latérale à gauche
donne accès à :

- **Vue d'ensemble** : statistiques rapides (nombre de chatbots, documents
  indexés, en traitement, en erreur) et raccourcis vers vos chatbots et
  documents récents.
- **Chatbots** : la liste complète de vos chatbots, avec la possibilité d'en
  créer un nouveau.
- **Documents** : tous les documents de tous vos chatbots, avec leur statut.
- **Templates** : les modèles de comportement disponibles (par défaut et les
  vôtres, voir section 5).
- **Documentation** : la documentation technique du produit.
- **Paramètres** : organisation (nom, plan), membres, email, mot de passe.

En haut de la barre latérale, le nom de votre organisation est cliquable :
cela ouvre un sélecteur pour basculer entre plusieurs organisations, ou en
créer une nouvelle.

## 4. Créer un chatbot

1. Depuis le dashboard ou la page Chatbots, cliquez sur **+ Créer un
   chatbot**.
2. Donnez-lui un nom.
3. Choisissez un template de comportement (voir section 5) — modifiable
   ensuite à tout moment.
4. Validez : le chatbot est créé, vous arrivez sur sa page de gestion.

## 5. Les templates (comportement du chatbot)

Un template définit le ton et les règles de réponse du chatbot. Des modèles
par défaut sont fournis :

- **Closer / vente** : ton direct, orienté objections et argumentaire.
- **Infopreneur / support client** : ton pédagogue, orienté FAQ.
- **Immobilier** : ton professionnel et rassurant pour les démarches
  immobilières.
- **Secrétariat médical / Santé** : usage strictement administratif
  (horaires, rendez-vous, documents à fournir) — ne donne jamais d'avis
  médical.
- **Formation & onboarding** : aide les nouveaux collaborateurs à retrouver
  une information dans la documentation interne d'une entreprise.

Vous pouvez aussi créer vos **propres templates personnalisés** (page
Templates, ou directement depuis l'éditeur de prompt d'un chatbot via
"Enregistrer comme template") pour les réutiliser sur plusieurs chatbots.

## 6. Ajouter des documents

Sur la page d'un chatbot, cliquez sur **+ Ajouter des documents**. Vous
pouvez sélectionner plusieurs fichiers d'un coup — ils sont envoyés et
traités en parallèle, pas besoin d'attendre qu'un document finisse avant
d'ajouter le suivant.

**Formats acceptés** : `.pdf` (avec texte natif, pas un scan), `.docx`,
`.txt`, `.md`, `.csv`, `.xlsx`, `.xls`.

**Non pris en charge pour l'instant** : PDF scannés sans texte (pas d'OCR).

Après l'upload, chaque document passe par plusieurs statuts, visibles dans
le tableau : `En attente` → `Traitement...` → `Indexé` (ou `Erreur` avec un
message expliquant pourquoi, par exemple un PDF scanné).

**Indexation assistée par IA (option Premium, plans PME/Métier)** : au lieu
du découpage mécanique standard, un modèle nettoie le texte (en-têtes
répétés, menus de navigation) et le segmente en respectant les sections
logiques du document — utile pour des documents mal formatés. Case à
cocher dans la section Documents de la page du chatbot ; grisée si votre
plan ne l'inclut pas.

## 7. Utiliser le chat

Depuis la page d'un chatbot, cliquez sur **Ouvrir le chat**. Posez vos
questions : le chatbot cherche les passages pertinents dans vos documents
indexés et répond en citant ses sources sous la réponse.

Si l'information demandée n'est dans aucun document, le chatbot vous le dira
plutôt que d'improviser une réponse.

## 8. Intégrer votre chatbot sur votre propre site web

N'importe quel chatbot public peut être intégré sur un site externe, de
deux façons.

**Option recommandée : bulle flottante en une ligne**

1. Récupérez l'identifiant de votre chatbot : il apparaît dans l'URL de sa
   page de gestion (`/dashboard/chatbots/VOTRE_ID`).
2. Ajoutez ce script sur votre page web, avant `</body>` :

```html
<script
  src="https://votre-domaine.com/widget.js"
  data-chatbot-id="VOTRE_ID"
  data-primary-color="#ff5a1f"
></script>
```

Une bulle apparaît en bas à droite et s'ouvre sur le chat au clic.
`data-primary-color` est optionnel : une couleur hex pour adapter le bouton
et les messages à votre charte graphique.

**Option alternative : iframe brute**, pour garder le contrôle total du
positionnement (panneau toujours visible dans une sidebar, par exemple) :

```html
<iframe
  src="https://votre-domaine.com/embed/VOTRE_ID"
  width="380"
  height="560"
  style="border:none;"
></iframe>
```

Dans les deux cas, le chat s'affiche directement sur votre site, sans que
vos visiteurs aient besoin de compte ni de connexion.

**Contrôle d'accès** (section "Accès public / embed" de la page du
chatbot) :
- **Chatbot public/privé** : un interrupteur pour désactiver complètement
  l'accès externe à tout moment.
- **Restriction par domaine** : une liste optionnelle des sites autorisés
  à intégrer ce chatbot — laissée vide, n'importe quel site le peut
  (comportement par défaut).

## 9. Gérer votre équipe

Dans **Paramètres → Membres**, renseignez l'email de la personne à
ajouter :
- Si elle a déjà un compte Corpus.ai, elle est ajoutée immédiatement.
- Sinon, un email d'invitation lui est envoyé pour créer son compte — à
  l'ouverture du lien, elle choisit un mot de passe puis rejoint
  automatiquement votre organisation.

Un propriétaire/administrateur peut aussi changer le rôle d'un membre
(Membre/Administrateur/Propriétaire) ou le retirer de l'organisation
directement depuis cette page. Chacun peut aussi quitter une organisation
lui-même.

## 10. Autres réglages

- **Renommer votre organisation, changer de plan** : Paramètres →
  Organisation.
- **Changer d'email** : Paramètres → Email — un email de confirmation est
  envoyé à la nouvelle adresse, le changement prend effet après avoir
  cliqué sur le lien reçu.
- **Changer de mot de passe** : Paramètres → Mot de passe.
- **Plusieurs organisations** : utilisez le sélecteur en haut de la barre
  latérale pour basculer entre vos organisations ou en créer une nouvelle.
- **Supprimer un chatbot** : sur la page du chatbot, section "Zone de
  danger" en bas — supprime définitivement le chatbot, ses documents et
  toutes ses conversations. Irréversible, demande de retaper le nom du
  chatbot pour confirmer.
- **Supprimer votre organisation** : Paramètres → section "Zone
  dangereuse", réservé au propriétaire. Supprime tout (chatbots,
  documents, conversations, membres) — irréversible.
