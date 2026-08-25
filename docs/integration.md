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

## ⚠️ Limitations connues (à traiter avant un vrai lancement public)

- **Pas de restriction de domaine** : n'importe qui connaissant l'ID d'un
  chatbot peut l'interroger via `/api/public-chat`, depuis n'importe quel
  site. Pas de whitelist d'origines autorisées pour l'instant.
- **Pas de rate limiting** : un ID de chatbot exposé publiquement peut en
  théorie être spammé, avec un coût réel (appels OpenAI + Anthropic).
- **Pas de contrôle "ce chatbot est-il embeddable"** : tous les chatbots sont
  accessibles via `/api/public-chat` et `/embed/*` dès qu'on connaît leur ID
  — il n'y a pas de case à cocher "autoriser l'embed" par chatbot.

Ces trois points sont acceptables pour du test interne / pilotes de
confiance, mais à corriger avant d'exposer un lien d'embed à un client final
ou de rendre `/embed/*` public sur un vrai site.

## Idées pour la suite (non fait)

- Whitelist de domaines autorisés par chatbot (colonne `allowed_origins` +
  vérification du header `Origin`/`Referer` dans `/api/public-chat`).
- Rate limiting par chatbot ou par IP sur `/api/public-chat`.
- Toggle "chatbot public / privé" dans les paramètres du chatbot.
- Personnalisation visuelle du widget embed (couleurs, position) par client.
