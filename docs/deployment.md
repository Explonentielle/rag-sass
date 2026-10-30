# Guide de déploiement — pilote à petite échelle

Objectif : passer de "tourne en local sur ma machine" à "accessible
publiquement, testable par de vrais utilisateurs". Voir `docs/architecture.md`
pour la topologie complète.

Briques à déployer, dans cet ordre (chacune dépend de la précédente) :
**VPS (Elasticsearch)** → **Supabase (migrations + SMTP)** → **Stripe (optionnel)** → **Vercel (l'app)**.
Le SMTP (étape 3) n'est nécessaire que pour les invitations d'équipe /
changement d'email, et Stripe (étape 4) que pour la facturation
automatique — sans ça, passe directement à l'étape 5 (Vercel).

---

## 1. VPS — Elasticsearch

Le `docker-compose.yml` à la racine est **dev-only** (sécurité désactivée,
pas de TLS) — jamais à exposer sur une IP publique tel quel.
`docker-compose.prod.yml` + `Caddyfile` sont la version prod : auth
activée, TLS automatique (Let's Encrypt) via Caddy en reverse-proxy.

**Prérequis** : un VPS avec Docker installé, et un sous-domaine DNS (ex.
`es.corpus-ai.fr`) dont l'enregistrement A pointe déjà vers l'IP publique
du VPS — Caddy a besoin que le DNS soit propagé *avant* de démarrer, sinon
la validation du certificat échoue.

```bash
# Sur le VPS, dans le dossier du projet (ou juste ces 3 fichiers copiés) :
cp .env.prod.example .env.prod
# Remplir ES_DOMAIN (le sous-domaine ci-dessus) et ELASTIC_PASSWORD
# (généré avec: openssl rand -base64 24)

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Vérifier (depuis le VPS ou n'importe où) :
curl -u elastic:LE_MOT_DE_PASSE https://es.corpus-ai.fr/_cluster/health
```

Garder `.env.prod` et le mot de passe `ELASTIC_PASSWORD` — ils seront
recopiés dans les variables d'environnement Vercel à l'étape 3.

**Note** : l'index `documents_chunks` (alias + analyseur français, item 39
du roadmap) se crée automatiquement au premier appel de l'app
(`ensureChunksIndex()`) — rien à faire manuellement ici si c'est un
environnement neuf. S'il y a déjà des données à migrer depuis un ancien
environnement, voir `scripts/migrate-french-analyzer.mts`.

### 1b. Même VPS — service OCR (optionnel, item 7 du roadmap)

Un second service, `ocr` (défini dans le même `docker-compose.prod.yml`),
tourne un petit serveur HTTP qui fait de l'OCR (Tesseract) sur les PDF
scannés — voir `ocr-service/`. Optionnel : sans lui, un PDF scanné est
simplement rejeté avec un message clair à l'upload, comme avant qu'il
existe.

**Pas de prérequis DNS supplémentaire** : ce service tourne sur le même
nom d'hôte que `ES_DOMAIN` (DNS acheté, ou nom auto-fourni par
l'hébergeur — ex. `xxx.vps.ovh.ca`), juste sur un port différent
(`8443`), via un second bloc dans le `Caddyfile`. Si un vrai domaine est
acheté pour le produit plus tard, ça peut être changé pour un sous-domaine
dédié, mais ce n'est pas nécessaire pour démarrer.

```bash
# Dans .env.prod (même fichier qu'à l'étape 1 ci-dessus), en plus de
# ES_DOMAIN/ELASTIC_PASSWORD, remplir :
#   OCR_SERVICE_SECRET (généré avec: openssl rand -base64 24)

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Vérifier (depuis le VPS ou n'importe où) :
curl -X POST \
  -H "Authorization: Bearer LE_SECRET" \
  -H "Content-Type: application/pdf" \
  --data-binary @un-pdf-scanne.pdf \
  https://<ES_DOMAIN>:8443/ocr
# → {"text": "...", "pageCount": N}
```

Garder `OCR_SERVICE_SECRET` — à recopier dans les variables Vercel à
l'étape 5 (`OCR_SERVICE_URL=https://<ES_DOMAIN>:8443`,
`OCR_SERVICE_SECRET=<même valeur>`).

---

## 2. Supabase — appliquer les migrations

**Aucune des 19 migrations n'est protégée contre une double exécution par
un mécanisme de suivi automatique** (pas de CLI Supabase liée, voir
`supabase/migrations/`) — mais la plupart sont écrites de façon
idempotente (`create table if not exists`, `add column if not exists`,
`drop ... if exists` avant de recréer). Dans **Supabase Dashboard → SQL
Editor**, exécute-les dans l'ordre, une par une :

| # | Fichier | Si déjà appliquée |
|---|---|---|
| 1 | `0001_init.sql` | Erreur sur un `create policy` → déjà appliquée, passe à la suivante |
| 2 | `0002_storage.sql` | Idem (policies storage) |
| 3 | `0003_custom_templates.sql` | Idem |
| 4 | `0004_conversations.sql` | Idem |
| 5 | `0005_multiple_conversations.sql` | Sans effet si déjà appliquée (`drop index if exists`) |
| 6 | `0006_conversation_retention.sql` | Sans effet si déjà appliquée (upsert du job cron) |
| 7 | `0007_chatbot_embed_controls.sql` | Sans effet si déjà appliquée (`add column if not exists`) |
| 8 | `0008_chatbot_no_document_mode.sql` | Sans effet si déjà appliquée |
| 9 | `0009_organization_plan.sql` | Sans effet si déjà appliquée |
| 10 | `0010_org_member_self_leave.sql` | Sans effet si déjà appliquée (`drop policy if exists` avant recréation) |
| 11 | `0011_organization_billing.sql` | Sans effet si déjà appliquée (`add column if not exists`) |
| 12 | `0012_chatbot_ai_indexing.sql` | Sans effet si déjà appliquée |
| 13 | `0013_document_url_source.sql` | Sans effet si déjà appliquée |
| 14 | `0014_chatbot_email_tool.sql` | Sans effet si déjà appliquée |
| 15 | `0015_chatbot_loading_messages.sql` | Sans effet si déjà appliquée |
| 16 | `0016_chatbot_notification_email.sql` | Sans effet si déjà appliquée |
| 17 | `0017_visitor_file_uploads.sql` | Sans effet si déjà appliquée (`drop policy if exists`, `on conflict do nothing`) |
| 18 | `0018_retention_purge_to_vercel_cron.sql` | Sans effet si déjà appliquée (désactive l'ancien job `pg_cron`, voir §5) |
| 19 | `0019_chatbot_loading_steps.sql` | Sans effet si déjà appliquée (`add column if not exists`) |

Pour les n° 1 à 4 : si l'exécution s'arrête sur une erreur
`policy "..." already exists`, c'est le signal que cette migration (au
moins sa partie policies) est déjà en place — passe simplement à la
migration suivante, rien d'autre à faire.

**Si c'est un projet Supabase tout neuf** (jamais aucune migration
appliquée) : exécute simplement les 18 dans l'ordre, aucune erreur
attendue.

**Vérification rapide après coup** : la purge de rétention (item 48 du
roadmap) ne tourne plus via `pg_cron` — `0018` désactive l'ancien job
SQL-only `purge-old-conversations` créé par `0006`, au profit d'un Vercel
Cron Job (`app/api/cron/purge-conversations/route.ts`), seul capable de
nettoyer aussi les fichiers visiteurs dans Storage (pas juste les lignes en
base). Rien à vérifier côté SQL Editor pour ça — la vérification se fait
côté Vercel, voir §5 et §6.

Dans **Authentication → Providers → Email**, désactive "Confirm email"
pour le pilote (évite la friction de confirmation pendant les tests) —
voir le README pour le détail.

---

## 3. Supabase — SMTP (invitations d'équipe, changement d'email)

Sans ça : les emails d'invitation (item 13) et de confirmation de
changement d'email (item 12) passent par l'expéditeur intégré de
Supabase, limité à quelques emails/heure sur le plan gratuit — suffisant
pour tester, pas pour un vrai pilote.

**Important** : ce n'est **pas** notre code applicatif qui envoie ces
emails — c'est Supabase Auth lui-même (`supabase.auth.admin.inviteUserByEmail`,
`supabase.auth.updateUser({ email })` dans le code appellent l'API Auth de
Supabase, qui envoie l'email de son côté). La configuration se fait donc
entièrement dans le **dashboard Supabase**, pas dans les variables
d'environnement Vercel.

**Avec Resend** : leur API REST (le SDK `resend` npm) ne convient pas
ici — Supabase Auth ne sait parler que SMTP pour son expéditeur
personnalisé, pas appeler une API tierce. Resend fournit justement un
**relai SMTP** pour ce genre de cas (`smtp.resend.com`) :

1. Créer un compte Resend, vérifier un domaine d'envoi (DNS).
2. Récupérer une clé API Resend (sert de mot de passe SMTP).
3. Dans **Supabase Dashboard → Project Settings → Auth → SMTP Settings** :
   - Host : `smtp.resend.com`
   - Port : `465` (SSL) ou `587` (STARTTLS)
   - Username : `resend`
   - Password : la clé API Resend
   - Sender email : une adresse du domaine vérifié (ex. `no-reply@corpus-ai.fr`)
4. Tester : inviter un membre depuis **Paramètres → Membres** dans l'app, vérifier que l'email arrive.

Aucun changement de code nécessaire une fois ça configuré.

**Même domaine pour l'outil email agentique** : une fois le domaine vérifié
sur Resend ici, il sert aussi à `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (étape
5, Vercel) — pas besoin de vérifier un deuxième domaine, une seule clé API
Resend suffit pour les deux usages.

---

## 4. Stripe — facturation (optionnel pour un pilote facturé à la main)

L'app ne crée aucune session de paiement elle-même — le webhook
(`app/api/webhooks/stripe/route.ts`) se contente de garder
`organizations.plan` synchronisé avec ce qui se passe côté Stripe, quelle
que soit la façon dont l'abonnement a été créé. Pas bloquant pour 2-3
clients pilotes facturés manuellement — à faire avant d'ouvrir plus
largement.

**Dépassement de quota (docs/roadmap.md items 17/36)** : chaque org
choisit elle-même, dans Paramètres > Organisation, d'être bloquée au
quota de son plan ou débitée automatiquement par tranche de dépassement
(`lib/plans.ts` : `OVERAGE_BLOCK_SIZE`/`OVERAGE_CHARGE_CENTS` —
**valeurs placeholder, à confirmer avant d'activer en mode Stripe live**).
Le débit automatique réutilise le moyen de paiement déjà enregistré lors
du paiement via Payment Link (`lib/stripe.ts` `chargeOverage`), facturé
une fois par jour par le cron `app/api/cron/charge-overage/route.ts`
(même mécanisme `CRON_SECRET` que `purge-conversations`, déjà dans
`vercel.json`). Applique la migration
`supabase/migrations/0020_organization_overage.sql` avant de l'activer.
**Teste d'abord en mode test Stripe** (carte `4242 4242 4242 4242`) :
vérifie qu'un débit automatique réussit bien et que `overage_charges`
reçoit la ligne attendue, avant d'envisager un abonnement live.

1. Créer un compte Stripe (mode test d'abord), un produit par plan
   (Solo/PME/Métier) avec un prix récurrent chacun.
2. Pour chaque prix, créer un **Payment Link** (Stripe Dashboard →
   Payment Links, aucun code requis) — c'est le lien à donner au client
   pour payer. **Important** : en partageant le lien avec un client
   précis, ajouter `?client_reference_id=<organization_id>` à l'URL (l'id
   de son organisation, visible dans l'URL du dashboard Corpus.ai) — c'est
   ce qui permet au webhook de savoir quel org vient de payer, sans aucun
   code de notre côté.
3. Récupérer les ids de prix (`price_...`, pas les ids de produit
   `prod_...`) et les mettre dans les variables d'environnement Vercel :
   `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PME`, `STRIPE_PRICE_METIER`.
4. Récupérer la clé secrète (Dashboard → Developers → API keys) →
   `STRIPE_SECRET_KEY`.
5. Créer le webhook (Dashboard → Developers → Webhooks → Add endpoint) :
   URL `https://TON-DOMAINE-VERCEL/api/webhooks/stripe`, événements à
   écouter : `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Récupérer le "Signing secret" généré →
   `STRIPE_WEBHOOK_SECRET`.
6. Tester : payer via un Payment Link avec une carte de test Stripe
   (`4242 4242 4242 4242`), vérifier dans Supabase que l'organisation a
   bien `plan` et `stripe_customer_id` mis à jour.

---

## 5. Vercel — déployer l'app

1. Importer le repo GitHub dans Vercel (Next.js détecté automatiquement).
   `vercel.json` à la racine du repo est déjà configuré pour le Cron Job de
   purge de rétention (`0 3 * * *`, voir item 48 du roadmap) — rien à
   configurer manuellement pour ça, juste `CRON_SECRET` ci-dessous.
2. Renseigner les variables d'environnement (Project Settings →
   Environment Variables) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Depuis Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Idem |
| `SUPABASE_SERVICE_ROLE_KEY` | Idem — **jamais** exposée côté client, uniquement en env serveur Vercel |
| `ELASTICSEARCH_URL` | `https://es.corpus-ai.fr` (le domaine de l'étape 1) |
| `ELASTICSEARCH_USERNAME` | `elastic` |
| `ELASTICSEARCH_PASSWORD` | Le `ELASTIC_PASSWORD` généré à l'étape 1 |
| `OCR_SERVICE_URL` | `https://<ES_DOMAIN>:8443` (même domaine que ci-dessus, port 8443 — étape 1b) — optionnel, sans lui un PDF scanné est juste rejeté comme avant |
| `OCR_SERVICE_SECRET` | Le `OCR_SERVICE_SECRET` généré à l'étape 1b |
| `OPENAI_API_KEY` | platform.openai.com, avec facturation active |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` (défaut) |
| `OPENAI_CHAT_MODEL` | `gpt-5.6-luna` (défaut, ou un modèle plus cher si besoin de qualité) |
| `CONVERSATION_ENCRYPTION_KEY` | `openssl rand -base64 32` — **si plusieurs environnements partagent la même base Supabase, cette clé doit être strictement identique partout**, sinon les messages chiffrés sur l'un deviennent illisibles depuis l'autre |
| `CRON_SECRET` | Project Settings → Cron Jobs sur Vercel en génère un automatiquement à l'activation, ou en définir un toi-même (`openssl rand -base64 24`). **Fortement recommandé en prod** — sans ça, `/api/cron/purge-conversations` n'a aucune authentification (voir item 48 du roadmap) |
| `RESEND_API_KEY` | Clé API Resend (platform resend.com → API Keys) — pour l'outil email agentique (`lib/email.ts`), distinct du SMTP Supabase de l'étape 3 ci-dessus mais même compte/domaine Resend |
| `RESEND_FROM_EMAIL` | Une adresse du domaine vérifié sur Resend (ex. `notifications@corpus-ai.fr`) — sans domaine vérifié, reste à `onboarding@resend.dev` (fonctionne mais moins pro, limites d'envoi) |
| `NEXT_PUBLIC_SUPPORT_CHATBOT_ID` | Optionnel — voir `docs/integration.md` |
| `STRIPE_SECRET_KEY` | Optionnel (étape 4) — Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Optionnel (étape 4) — généré à la création du webhook |
| `STRIPE_PRICE_SOLO` / `_PME` / `_METIER` | Optionnel (étape 4) — ids `price_...` de chaque plan |

3. Déployer. Vercel gère `waitUntil`/`maxDuration` (déjà configurés dans
   le code pour l'ingestion async et le streaming de chat) nativement.

---

## 6. Vérification post-déploiement

1. Créer un compte, une organisation, un chatbot.
2. Uploader un document, vérifier qu'il passe `pending` → `indexed`.
3. Poser une question dans le chat, vérifier le streaming + les sources citées.
4. Tester l'embed public (`widget.js` ou `/embed/[chatbotId]`) depuis un
   autre domaine — voir `docs/integration.md`.
5. Vérifier que l'index ES a bien l'analyseur français :
   ```bash
   curl -u elastic:MOT_DE_PASSE https://es.corpus-ai.fr/documents_chunks/_mapping
   # doit montrer "content": { "analyzer": "french_content" }
   ```

## 7. Avant d'onboarder un vrai client externe (pas juste toi en test)

Voir `docs/rgpd-conformite.md` — mention à afficher aux visiteurs du
widget + gabarit de DPA à faire signer. Pas strictement bloquant pour
*toi* qui testes en interne, mais requis dès qu'un vrai visiteur externe
discute avec le bot (RGPD).
