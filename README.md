# RAG SaaS — MVP

Chatbot RAG multi-tenant : upload de documents internes → indexation (Elasticsearch, hybrid search) → chat (Claude) avec citation des sources.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + backend (API routes)
- **Supabase** — Postgres (multi-tenant + RLS), Auth, Storage
- **Elasticsearch** — recherche hybride (full-text + dense_vector, fusion RRF calculée côté application — voir note plus bas)
- **OpenAI** (`text-embedding-3-small`) — embeddings
- **Anthropic** (`claude-haiku-4-5-20251001` par défaut, `claude-sonnet-5` possible) — génération

## Ce que tu dois faire toi-même avant de lancer le projet

Ces étapes ne peuvent pas être automatisées depuis ce repo :

1. **Créer un projet Supabase** sur [supabase.com](https://supabase.com).
   - Dans **SQL Editor**, exécute dans l'ordre le contenu de `supabase/migrations/0001_init.sql` puis `supabase/migrations/0002_storage.sql`.
   - Dans **Authentication > Providers > Email**, pour le pilote je recommande de **désactiver "Confirm email"** (Settings > Auth) pour éviter la friction de confirmation par email pendant les tests — sinon prévois de recevoir/valider l'email de confirmation avant la 1ère connexion.
   - Récupère `Project URL`, `anon public key` et `service_role key` dans **Settings > API**.
2. **Créer une clé API OpenAI** sur [platform.openai.com](https://platform.openai.com/api-keys).
3. **Créer une clé API Anthropic** sur [console.anthropic.com](https://console.anthropic.com/settings/keys).
4. **Avoir Docker installé** (Docker Desktop sur Windows) pour lancer Elasticsearch en local.

## Setup

```bash
# 1. Dépendances
npm install

# 2. Elasticsearch en local
docker compose up -d
# vérifier que ça tourne : http://localhost:9201 doit répondre (pas d'auth en dev)
# (port 9201, pas 9200 — évite le conflit avec un éventuel autre ES local sur cette machine)

# 3. Variables d'environnement
cp .env.example .env.local
# remplir NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# OPENAI_API_KEY, ANTHROPIC_API_KEY (ELASTICSEARCH_URL par défaut convient pour le local)

# 4. Lancer le projet
npm run dev
```

### Vérification rapide du pipeline (optionnel)

`scripts/smoke-test.mts` teste extraction → chunking → embeddings OpenAI → indexation ES → recherche hybride → isolation multi-tenant, sans dépendre de Supabase/Anthropic. Utile pour valider `OPENAI_API_KEY` et Elasticsearch indépendamment du reste :

```bash
npm run smoke-test
```

Ouvre [http://localhost:3000](http://localhost:3000) → redirige vers `/login`.

1. Crée un compte (`/signup`) — ça crée aussi ton organisation.
2. Crée un chatbot, choisis un template ("Closer / vente" ou "Infopreneur / support").
3. Uploade un `.pdf` (texte natif), `.docx` ou `.txt` — le statut passe `pending` → `processing` → `indexed`.
4. Ouvre le chat et pose une question sur le contenu du document.

## Structure

```
app/
  (auth)/login, (auth)/signup       — pages d'auth Supabase
  auth/callback                     — callback confirmation email
  dashboard/                        — liste des chatbots, création
  dashboard/chatbots/[id]/          — upload docs, config prompt
  dashboard/chatbots/[id]/chat/     — interface de chat
  api/chatbots/                     — CRUD chatbots
  api/documents/upload/             — upload + pipeline d'ingestion (synchrone)
  api/chat/                         — pipeline RAG (SSE streaming)
lib/
  supabase/                         — clients browser/server
  elasticsearch.ts                  — client ES, mapping, recherche hybride RRF
  extract.ts                        — extraction texte PDF/DOCX/TXT + détection scan
  chunking.ts                       — découpage en chunks avec overlap
  ingest.ts                         — orchestration extraction → chunk → embed → index
  openai.ts, anthropic.ts           — clients LLM
  prompts.ts                        — templates de system prompt
supabase/migrations/                — schéma SQL + RLS (à exécuter manuellement)
docker-compose.yml                  — Elasticsearch (+ Kibana optionnel) local
```

## Décisions techniques prises (à valider / ajuster)

- **Chunking** : découpage par phrases, cible ~650 tokens (estimation ~4 caractères/token, pas de tokenizer dédié), overlap ~80 tokens (~12%). Une phrase plus longue que la cible est découpée brutalement en dernier recours. Voir `lib/chunking.ts`.
- **Ingestion synchrone** : le pipeline (extraction → chunk → embeddings → indexation ES) tourne dans la requête d'upload elle-même (pas de queue/worker). Simple pour le MVP ; à revoir si des documents volumineux font timeout ou si le volume grossit.
- **Detection de PDF scanné** : heuristique — si le texte extrait fait moins de ~20 caractères/page en moyenne, on considère que c'est un scan sans couche texte et on renvoie une erreur claire (voir `lib/extract.ts`). Pas d'OCR.
- **Un seul org par utilisateur** dans l'UI actuelle (le schéma supporte plusieurs organisations par utilisateur via `users_organizations`, mais le dashboard prend la première trouvée). Le switch multi-org est à ajouter plus tard si besoin.
- **Rôles** (`owner`/`admin`/`member`) : la colonne existe et les policies RLS distinguent déjà `is_org_member` vs `is_org_admin`, mais l'UI ne gère pas encore l'invitation de coéquipiers — un seul utilisateur (le créateur, `owner`) par organisation pour l'instant.
- **Formats non supportés** (csv, xlsx, images...) : rejetés à l'upload avec un message explicite, sans créer de ligne `documents`.

## Notes de sécurité multi-tenant

- Toutes les tables Postgres ont RLS activé, scopées par organisation (directement ou via `chatbots.organization_id`).
- Le bucket Storage `documents` a des policies RLS basées sur le premier segment du chemin (`{organization_id}/...`).
- Elasticsearch n'a **pas** de RLS native : chaque requête (indexation et recherche) filtre explicitement sur `organization_id` + `chatbot_id` côté application (`lib/elasticsearch.ts`). C'est le point critique à ne jamais contourner si tu ajoutes de nouvelles routes qui touchent l'index.

## Vers un cluster Elasticsearch hébergé

Rien à changer dans le code : renseigne `ELASTICSEARCH_URL` (et `ELASTICSEARCH_USERNAME`/`ELASTICSEARCH_PASSWORD`, ou `ELASTICSEARCH_API_KEY`) dans `.env.local`. Le mapping de l'index est créé automatiquement au premier appel si l'index n'existe pas encore (`ensureChunksIndex()`).

Note sur la RRF : l'API `retriever.rrf` native d'Elasticsearch nécessite une licence **Platinum** (vérifié en local — erreur `security_exception: current license is non-compliant for RRF` sous licence Basic). Comme la cible est un cluster potentiellement auto-hébergé en Basic, `hybridSearch()` (`lib/elasticsearch.ts`) fait deux requêtes séparées (BM25 sur `content`, kNN sur `embedding`) et fusionne les résultats en JS avec la même formule RRF qu'Elasticsearch utilise en interne (`score = Σ 1 / (60 + rang)`). Fonctionne sous licence Basic, testé en local. Si le cluster cible dispose d'une licence Platinum, on pourrait basculer sur `retriever.rrf` natif pour économiser un aller-retour réseau — pas nécessaire pour le MVP.
