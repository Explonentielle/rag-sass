# Architecture

Vue d'ensemble des composants, des bases de données et des flux de données.
Référence technique — pour le guide de mise en prod, voir `docs/deployment.md`.

## Composants et topologie de déploiement cible

```mermaid
flowchart TB
    subgraph Visiteurs["Visiteurs / clients"]
        Browser["Navigateur<br/>(dashboard Corpus.ai)"]
        EmbedSite["Site tiers d'un client<br/>(widget.js / iframe embed)"]
    end

    subgraph Vercel["Vercel (Next.js, App Router)"]
        App["App Next.js<br/>pages + API routes<br/>app/api/chat, app/api/public-chat,<br/>app/api/documents/upload..."]
    end

    subgraph VPS["VPS (Docker, auto-hébergé)"]
        Caddy["Caddy (reverse proxy)<br/>TLS + Basic Auth"]
        ES[("Elasticsearch<br/>index documents_chunks<br/>(alias -> index physique versionné)")]
        OCR["Service OCR<br/>(Tesseract + poppler-utils)"]
        Caddy --> ES
        Caddy --> OCR
    end

    subgraph SupabaseCloud["Supabase Cloud"]
        PG[("Postgres<br/>orgs, chatbots, documents,<br/>conversations, messages...")]
        Auth["Auth<br/>(comptes utilisateurs)"]
        Storage[("Storage<br/>fichiers sources uploadés")]
        Cron["pg_cron<br/>purge RGPD quotidienne"]
        Cron --> PG
    end

    subgraph OpenAICloud["OpenAI API"]
        Embeddings["Embeddings<br/>text-embedding-3-small"]
        ChatModel["Chat<br/>gpt-5.6-luna"]
    end

    Browser -->|HTTPS| App
    EmbedSite -->|HTTPS, POST /api/public-chat| App
    App -->|requêtes SQL via supabase-js| PG
    App -->|auth, sessions| Auth
    App -->|upload/lecture fichiers| Storage
    App -->|HTTPS + auth| Caddy
    App -->|HTTPS + secret partagé, PDF scanné uniquement| Caddy
    App -->|embeddings + génération| Embeddings
    App -->|génération réponse| ChatModel
```

**Pourquoi un VPS pour Elasticsearch et pas un service managé** : décision
actuelle pour rester sur deux fournisseurs (Supabase + OpenAI) plutôt que
trois ; un ES managé (Elastic Cloud) reste une option si l'auto-hébergement
devient un fardeau opérationnel. Voir `docs/deployment.md` pour le
compose de prod (sécurité activée, contrairement à `docker-compose.yml`
qui est dev-only).

## Bases de données et ce qu'elles contiennent

| Store | Rôle | Contenu | Notes |
|---|---|---|---|
| **Postgres (Supabase)** | Source de vérité métier, multi-tenant | `organizations`, `chatbots`, `documents` (métadonnées), `conversations`/`messages` (chiffrés en AES-256-GCM), `custom_templates`, `users_organizations` | RLS sur toutes les tables, scopées par `organization_id` (directement ou via jointure). Voir `supabase/migrations/`. |
| **Supabase Storage** | Fichiers sources uploadés | PDF/DOCX/TXT/MD/CSV/XLSX bruts, à `{organization_id}/{chatbot_id}/{document_id}-{filename}` | RLS basée sur le 1er segment du chemin. Pas le contenu indexé — juste l'original, pour re-traitement éventuel. |
| **Elasticsearch** | Index de recherche hybride | `documents_chunks` (alias) → chunks de texte + vecteurs d'embedding (1536 dims), `organization_id`/`chatbot_id`/`document_id` en `keyword` | **Pas de RLS native** — l'isolation multi-tenant est appliquée à la main dans `lib/elasticsearch.ts` (filtre obligatoire sur `organization_id` + `chatbot_id` à chaque requête). Point critique à ne jamais contourner. Analyseur français (stemming) depuis l'item 39 du roadmap. |
| **Service OCR** | Fallback OCR pour les PDF scannés (`ocr-service/`, item 7 du roadmap) | Ne stocke rien — reçoit un PDF, renvoie le texte reconnu (Tesseract), rien de persisté côté service | Appelé uniquement quand `lib/extract.ts` détecte un PDF sans texte natif. Optionnel : non configuré, un tel PDF est simplement rejeté. Secret partagé (`OCR_SERVICE_SECRET`), pas de RLS applicable (pas de base de données). |

## Flux : ingestion d'un document

```mermaid
sequenceDiagram
    participant U as Utilisateur (dashboard)
    participant API as API Next.js<br/>(upload/route.ts)
    participant Storage as Supabase Storage
    participant PG as Postgres
    participant Extract as lib/extract.ts +<br/>lib/chunking.ts
    participant OpenAI as OpenAI Embeddings
    participant ES as Elasticsearch

    U->>API: POST fichier (PDF/DOCX/TXT/MD/CSV/XLSX)
    API->>Storage: sauvegarde le fichier original
    API->>PG: crée la ligne documents (status: pending)
    API-->>U: réponse immédiate (202)
    Note over API: traitement continue en tâche de fond (waitUntil)
    API->>Extract: extraction texte + découpage en chunks
    API->>OpenAI: embedTexts(chunks)
    OpenAI-->>API: vecteurs (1536 dims) par chunk
    API->>ES: bulk index (content, embedding, organization_id, chatbot_id...)
    API->>PG: update documents (status: indexed | error)
    U->>API: GET /api/documents/[id] (polling 2s)
    API-->>U: statut à jour
```

## Flux : question dans le chat (RAG)

```mermaid
sequenceDiagram
    participant U as Utilisateur / visiteur
    participant API as /api/chat ou<br/>/api/public-chat
    participant OpenAI as OpenAI
    participant ES as Elasticsearch
    participant PG as Postgres

    U->>API: question (+ conversationId optionnel)
    API->>PG: charge l'historique de la conversation (déchiffré)
    API->>OpenAI: rewriteQuery(question)
    OpenAI-->>API: semanticQuery + keywordQuery
    API->>OpenAI: embedText(semanticQuery)
    OpenAI-->>API: vecteur de la requête
    API->>ES: hybridSearch (BM25 + kNN, filtré org+chatbot)
    ES-->>API: chunks candidats (fusionnés par RRF)
    API->>OpenAI: rerankChunks(question brute, chunks)
    OpenAI-->>API: chunks réordonnés/filtrés (max 5)
    API->>OpenAI: streamAnswer(system prompt + chunks + historique)
    OpenAI-->>U: réponse en streaming (SSE)
    API->>PG: appendTurn (question + réponse chiffrées)
```

## Isolation multi-tenant — récapitulatif

- **Postgres** : RLS sur chaque table, scopée par `organization_id`.
- **Storage** : policy RLS sur le chemin (`{organization_id}/...`).
- **Elasticsearch** : aucune RLS native — filtre applicatif obligatoire
  (`organization_id` + `chatbot_id`) dans `hybridSearch`,
  `deleteDocumentChunks`, `deleteOrganizationChunks`. Toute nouvelle route
  qui touche l'index doit respecter ce filtre.
- **Chiffrement applicatif** : `content`/`sources` des messages chiffrés en
  AES-256-GCM avant insertion Postgres (`lib/crypto.ts`) — protège même
  contre un accès direct avec la clé service-role.
