# Corpus.ai : plateforme de chatbots RAG multi-tenant

Chaque organisation crée des chatbots, y indexe ses documents (ou des pages web), puis les déploie sur son site (widget ou iframe) ou les garde en interne. Les réponses s'appuient uniquement sur les documents de l'organisation et citent leurs sources.

## Fonctionnalités

- **Chatbots** : templates de prompt, mode « prompt seul » (sans documents), chatbot public (widget) ou privé/interne, couleur et domaines autorisés pour l'embed.
- **Ingestion** : PDF (texte ou scanné via OCR), DOCX, TXT, MD, CSV, XLSX, images (PNG/JPG/WEBP), pages web et site entier. Indexation en arrière-plan, plusieurs fichiers en parallèle, indexation assistée par IA sur les plans supérieurs.
- **Recherche** : hybride (BM25 + vecteurs, fusion RRF), reformulation de la question, reranking, analyseur français.
- **Chat** : streaming SSE, historique chiffré, conversations consultables dans le dashboard, étapes de chargement personnalisables ou réelles, envoi de fichiers par le visiteur (réglable par chatbot).
- **Outils agentiques** : email au propriétaire sur demande du visiteur (avec confirmation), qualification de leads.
- **Modules** : analyseur de contrats, digitaliseur de paperasse, transcription de réunions (« Second cerveau »).
- **Compte** : multi-organisations, équipe (rôles, invitations), onboarding guidé, suppression d'organisation.
- **Facturation** : Stripe (plans Gratuit / Solo / PME / Métier, portail client, dépassement au choix : blocage ou débit automatique).
- **Conformité** : rétention de 90 jours avec purge automatique (cron Vercel), chiffrement des messages, pages légales (brouillon).

## Stack

| Couche | Technologie |
|---|---|
| App | Next.js 14 (App Router), TypeScript strict, Tailwind |
| Données | Supabase : Postgres (RLS), Auth, Storage |
| Recherche | Elasticsearch 8 (auto-hébergé sur VPS en prod) |
| IA | OpenAI (embeddings + chat, `gpt-5.6-luna` par défaut) |
| OCR | Service Tesseract maison (`ocr-service/`), sur le même VPS |
| Paiement / email | Stripe / Resend |
| Hébergement | Vercel (app + crons) + VPS OVH (Elasticsearch, OCR, Caddy) |

`lib/anthropic.ts` reste dans le repo mais rien ne l'utilise actuellement.

## Démarrage en local

Prérequis : Node 18.17+ (requis par Next.js 14), Docker, un projet Supabase, une clé API OpenAI.

```bash
# 1. Dépendances
npm install

# 2. Elasticsearch local (port 9201, sans authentification, dev uniquement)
docker compose up -d

# 3. Variables d'environnement
cp .env.example .env.local
# Renseigner au minimum : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, CONVERSATION_ENCRYPTION_KEY.
# ELASTICSEARCH_URL par défaut (http://localhost:9201) convient en local.

# 4. Lancer
npm run dev
```

**Base de données** : dans le *SQL Editor* de Supabase, exécuter **toutes** les migrations de `supabase/migrations/` dans l'ordre (`0001` à `0031`). Pour un pilote, désactiver « Confirm email » dans Authentication > Providers > Email évite la friction des tests.

Ouvrir [http://localhost:3000](http://localhost:3000), créer un compte (`/signup`, cela crée aussi l'organisation), créer un chatbot, uploader un document puis poser une question.

### Variables d'environnement

Voir `.env.example`, qui est la référence. Obligatoires pour le cœur du produit : Supabase, Elasticsearch, OpenAI, `CONVERSATION_ENCRYPTION_KEY`. Optionnelles selon les fonctions : `OCR_SERVICE_*` (PDF scannés et images), `STRIPE_*` (abonnements), `RESEND_*` (emails), `CRON_SECRET` (protège les endpoints de cron).

### Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Serveur de dev, build et lancement de prod |
| `npm run lint` / `typecheck` | Lint et vérification des types |
| `npm test` / `test:watch` | Tests unitaires (Vitest) |
| `npm run smoke-test` | Vérifie extraction, embeddings, indexation et isolation multi-tenant sans passer par Supabase |

## Structure

```
app/
  (auth)/                 login, signup
  dashboard/              chatbots, documents, contrats, paperasse, second-cerveau, plan, settings
  embed/[chatbotId]/      page chargée dans l'iframe du widget
  api/                    chat, public-chat, chatbots, documents, billing, cron, webhooks, organizations
  legal/[slug]/           mentions légales, CGU, confidentialité
lib/                      logique métier (RAG, ingestion, plans, usage, Stripe, outils agentiques...)
components/               composants React (components/ui/ = primitives partagées)
supabase/migrations/      schéma SQL + RLS, à exécuter dans l'ordre
ocr-service/              service OCR Tesseract (déployé sur le VPS)
docker-compose.yml        Elasticsearch de dev
docker-compose.prod.yml   Elasticsearch sécurisé + OCR + Caddy (VPS)
docs/                     documentation (voir plus bas)
```

## Production

- **App** : Vercel (les crons de `vercel.json` gèrent la purge des conversations et le débit des dépassements).
- **Elasticsearch + OCR** : VPS avec `docker-compose.prod.yml`. Seul Caddy est exposé (HTTPS automatique), Elasticsearch et l'OCR restent sur le réseau Docker interne, avec authentification.
- **Données** : Supabase.

Le pas-à-pas complet est dans `docs/deployment.md`.

## Sécurité multi-tenant

- Toutes les tables Postgres ont RLS activé, scopé par organisation. Les buckets Storage sont privés, avec des policies basées sur l'organisation.
- Elasticsearch n'a **pas** de RLS : chaque requête filtre explicitement sur `organization_id` et `chatbot_id` (`lib/elasticsearch.ts`). Ne jamais contourner ce filtre dans une nouvelle route qui touche l'index.
- Les chatbots publics sont limités par `allowed_origins` (vérification d'origine + CSP `frame-ancestors`) et par un rate limiting.
- L'ingestion par URL est protégée contre le SSRF (adresses privées bloquées, redirections revalidées).

## Note sur la fusion RRF

L'API `retriever.rrf` native d'Elasticsearch exige une licence Platinum. `hybridSearch()` fait donc deux requêtes (BM25 sur `content`, kNN sur `embedding`) et fusionne côté application avec la même formule (`score = Σ 1 / (60 + rang)`), ce qui fonctionne sous licence Basic.

## Documentation

- `docs/architecture.md` : composants, flux d'ingestion et de chat, bases de données.
- `docs/deployment.md` : mise en production (VPS, migrations, Vercel).
- `docs/integration.md` : intégrer un chatbot sur un site tiers (widget, iframe).
- `docs/guide-utilisateur.md` : guide d'utilisation du dashboard.
- `docs/metrics.md` : suivi d'usage et de coût.
- `docs/rgpd-conformite.md` : sous-traitants, registre de traitement, mentions visiteur.
- `docs/roadmap.md` : backlog, décisions prises et leurs raisons.

## Méthode de travail

Les règles de collaboration (plan avant les gros changements, TypeScript strict, pas de dépendance sans validation) sont dans `CLAUDE.md`.
