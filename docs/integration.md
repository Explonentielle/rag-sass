# Intégrer un chatbot Corpus.ai sur un site tiers

Deux façons d'intégrer un chatbot sur le site d'un client, selon combien de
contrôle il veut sur l'apparence.

## Option recommandée : bulle flottante prête à l'emploi

Une seule ligne à coller avant `</body>` :

```html
<script src="https://VOTRE-DOMAINE-CORPUS/widget.js" data-chatbot-id="ID_DU_CHATBOT"></script>
```

Ça affiche une bulle en bas à droite qui s'ouvre sur le chat au clic —
identique au widget flottant utilisé sur le site de Corpus.ai lui-même,
mais distribuable sur n'importe quel site externe.

**Comment ça marche** : `public/widget.js` crée une `<iframe>` qui pointe
vers `/embed/[chatbotId]?widget=1` (chrome bulle+toggle intégré, voir
`components/EmbedBubbleWidget.tsx`). Une iframe ne peut pas dessiner sa
propre bulle par-dessus le reste de la page hôte (barrière de sécurité du
navigateur) — à la place, l'iframe prévient la page parente par
`postMessage` quand elle s'ouvre/se ferme, et `widget.js` redimensionne
l'élément iframe en conséquence (petit cercle fermé, grand panneau ouvert,
plein écran sur mobile). Le `data-chatbot-id` doit correspondre à un
chatbot existant ; `origin` est déduit automatiquement de l'URL du script,
donc ça fonctionne sans configuration supplémentaire quel que soit le nom
de domaine où l'app Corpus.ai est déployée.

## Option alternative : iframe brute, wrapper géré par le client

Pour un client qui veut son propre positionnement/style (pas de bulle,
panneau toujours visible dans une sidebar, etc.) :

```html
<iframe
  src="https://VOTRE-DOMAINE-CORPUS/embed/ID_DU_CHATBOT"
  style="width: 400px; height: 600px; border: 0;"
></iframe>
```

Cette page (`/embed/[chatbotId]` sans `?widget=1`) n'a aucun chrome — elle
remplit exactement le cadre de l'iframe telle que dimensionnée par le
client. À lui de gérer positionnement, ouverture/fermeture, responsive.

## Widget flottant interne (landing + app Corpus.ai)

Distinct de ce qui précède : une bulle de chat en bas à droite, visible sur
toutes les pages de l'app Corpus.ai elle-même (landing publique et
intérieur de l'app), pas destinée à un site tiers. Activée en configurant
`NEXT_PUBLIC_SUPPORT_CHATBOT_ID` dans `.env` avec l'ID d'un chatbot
existant — vide par défaut, le widget ne s'affiche pas tant que la
variable n'est pas renseignée (`components/FloatingChatWidget.tsx`).

**Setup** :
1. Créez un chatbot dédié (ex. "Support Corpus.ai") avec vos propres docs
   (FAQ produit, ce README...) comme documents.
2. Récupérez son ID (visible dans l'URL de sa page : `/dashboard/chatbots/{id}`).
3. Ajoutez `NEXT_PUBLIC_SUPPORT_CHATBOT_ID={id}` dans `.env`.
4. Redémarrez `npm run dev`.

## Endpoint public

`POST /api/public-chat` (`app/api/public-chat/route.ts`) — même pipeline
RAG que le chat authentifié (`/api/chat`), mais **sans vérification de
session**. Utilisé par le widget flottant interne, `/embed/[chatbotId]` et
`/embed/[chatbotId]?widget=1`.

## Sécurité et limites connues

- **Allowlist de domaines ✅ fait** (`docs/roadmap.md` item 31) : chaque
  chatbot a une colonne `allowed_origins` (liste, vide par défaut = pas de
  restriction) réglable dans `/dashboard/chatbots/[id]` →
  `EmbedSettingsForm`. Appliquée en deux couches : header CSP
  `frame-ancestors` posé par `middleware.ts` sur `/embed/[chatbotId]`
  (bloque le chargement de l'iframe elle-même, couvre aussi bien le mode
  `widget.js` que l'iframe brute puisque les deux passent par cette même
  route), et vérification `Origin`/`Referer` côté `/api/public-chat` pour
  les appels directs. Voir `lib/embedAccess.ts`.
- **Toggle "chatbot public/privé" ✅ fait** (même item) : colonne
  `is_public` (défaut `true`, rétrocompatible). Désactivé, `/api/public-chat`
  et `/embed/[chatbotId]` (donc aussi `widget.js`, qui charge cette même
  route) renvoient `404` uniformément, quel que soit le site appelant.
- **`postMessage` en `'*'`** : `widget.js` et `EmbedBubbleWidget` échangent
  leur message d'état ouvert/fermé sans restreindre l'origine, puisque le
  script est censé fonctionner sur n'importe quel domaine client — le
  payload ne contient qu'un booléen, pas de donnée sensible.
- **Historique de conversation** : géré par `visitorId` (UUID en
  localStorage du navigateur du visiteur, scopé à l'origine de l'iframe —
  donc à Corpus.ai, pas au site du client). Voir `docs/roadmap.md` item 9.
  Suppression possible à la demande (RGPD) — voir item 20-B.

## Idées pour la suite (non fait)

- Personnalisation visuelle du widget embed (couleurs, position) par client
  — aujourd'hui `widget.js` a une seule apparence, non paramétrable.
- Rôles/permissions différents par domaine autorisé (aujourd'hui
  `allowed_origins` est une liste plate, tout domaine listé a le même accès).
