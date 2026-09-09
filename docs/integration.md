# Intégration du chatbot

Documentation à compléter au fur et à mesure. État actuel : embed iframe basique et
widget flottant interne, tous deux publics (pas de login requis).

## Widget flottant (landing + app)

Une bulle de chat en bas à droite, visible sur toutes les pages (landing
publique et intérieur de l'app), activée en configurant
`NEXT_PUBLIC_SUPPORT_CHATBOT_ID` dans `.env` avec l'ID d'un chatbot existant.
Vide par défaut : le widget ne s'affiche pas tant que la variable n'est pas
renseignée.

**Setup** :
1. Créez un chatbot dédié (ex. "Support Corpus.ai") avec vos propres docs
   (FAQ produit, ce README...) comme documents.
2. Récupérez son ID (visible dans l'URL de sa page : `/dashboard/chatbots/{id}`).
3. Ajoutez `NEXT_PUBLIC_SUPPORT_CHATBOT_ID={id}` dans `.env`.
4. Redémarrez `npm run dev`.

## Embed iframe pour sites tiers

N'importe quel chatbot peut être embarqué via :

```html
<iframe
  src="https://votre-domaine.com/embed/{chatbotId}"
  width="380"
  height="560"
  style="border:none;"
></iframe>
```

La page `/embed/[chatbotId]` (`app/embed/[chatbotId]/page.tsx`) est un chat
minimal sans navigation, prévu pour être chargé en iframe.

## Endpoint public

`POST /api/public-chat` (`app/api/public-chat/route.ts`) — même pipeline RAG
que le chat authentifié (`/api/chat`), mais **sans vérification de session**.
Utilisé par le widget flottant et par `/embed/[chatbotId]`.

## Contrôles d'accès pour les embeds publics ✅

**Déploiement (2026-09-08)** : deux mesures pour limiter l'accès avant un
vrai lancement public (voir `docs/roadmap.md` item 22).

### 1. Toggle "chatbot public / privé"

Colonne `is_public` (défaut `true`, opt-in pour la restriction). Bascule
dans les paramètres du chatbot (`/dashboard/chatbots/[id]` → "Accès public /
embed"). Quand désactivé :

- `GET /api/public-chat` → 404 (impossible de lister les conversations)
- `POST /api/public-chat` → 404 (impossible de chatter)
- `DELETE /api/public-chat` → 404 (impossible de supprimer une conversation)
- `/embed/[chatbotId]` → 404 (impossible de charger la page)

### 2. Restriction par domaine d'origine

Colonne `allowed_origins` (tableau, défaut vide = aucune restriction, opt-in
pour la whitelist). Renseigner une liste de domaines autorisés (ex.
`https://client.com`, `https://www.client.com`) dans le formulaire d'embed.

**Implémentation** :

- `lib/embedAccess.ts` : logique `getRequestOrigin()`, `isOriginAllowed()`
  (Edge + Node-safe, pas de dépendances Node).
- `middleware.ts` : `/embed/[chatbotId]` bascule la page en 404 si
  `is_public=false`, et applique le header CSP `frame-ancestors` (mécanisme
  du navigateur pour bloquer les iframes non autorisées au chargement de la
  page elle-même).
- `app/api/public-chat/route.ts` (GET/POST/DELETE) : vérifie `is_public` et
  `allowed_origins` via `getAccessibleChatbot()`. Note technique : la vérif
  Origin sur l'endpoint API détecte les appels fetch directs, mais une page
  iframée par un tiers qui appelle fetch depuis le JS embarqué aura
  `Origin = self` (même domaine que `/embed/[chatbotId]`) — l'isolation vient
  du CSP, pas de l'Origin check. Cas rare (appels API directs cross-domain)
  capturés par Origin ; cas normal (iframe autorisée qui chatte avec son
  endpoint) autorié automatiquement.
- `/dashboard/chatbots/[id]` : nouveau formulaire `EmbedSettingsForm` pour
  gérer les deux flags (apparence nouvelle section "Accès public / embed").

**Comportement par défaut** : `is_public=true`, `allowed_origins=[]`. Un
chatbot créé sans configuration reste accessible comme avant (backward
compatible). La restriction est opt-in — un owner doit l'activer
explicitement pour chaque chatbot.

**Rate limiting (item 10, depuis longtemps)** : 20 req/min par (chatbot, IP),
blacklist 24h en cas d'abus soutenu (voir `lib/rateLimit.ts`). Orthogonal à
la restriction de domaine / toggle public (qui contrôle *qui* peut accéder,
quand rate-limiting contrôle *combien* d'accès).

## Idées pour la suite (non fait)

- Personnalisation visuelle du widget embed (couleurs, position) par client.
- Système de rôles pour les embeds (level de permission différent par domaine
  autorisé).
