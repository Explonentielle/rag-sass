# Guide de déploiement — pilote à petite échelle

Objectif : passer de "tourne en local sur ma machine" à "accessible
publiquement, testable par de vrais utilisateurs". Voir `docs/architecture.md`
pour la topologie complète.

Trois briques à déployer, dans cet ordre (chacune dépend de la précédente) :
**VPS (Elasticsearch)** → **Supabase (migrations)** → **Vercel (l'app)**.

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

---

## 2. Supabase — appliquer les migrations

**Aucune des 10 migrations n'est protégée contre une double exécution par
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

Pour les n° 1 à 4 : si l'exécution s'arrête sur une erreur
`policy "..." already exists`, c'est le signal que cette migration (au
moins sa partie policies) est déjà en place — passe simplement à la
migration suivante, rien d'autre à faire.

**Si c'est un projet Supabase tout neuf** (jamais aucune migration
appliquée) : exécute simplement les 10 dans l'ordre, aucune erreur
attendue.

**Vérification rapide après coup** (SQL Editor) :
```sql
select cron.job_run_details.status, cron.job_run_details.start_time
from cron.job_run_details
join cron.job on cron.job.jobid = cron.job_run_details.jobid
where cron.job.jobname = 'purge-old-conversations'
order by start_time desc limit 5;
```
Si cette requête échoue (`relation "cron.job" does not exist`), l'extension
`pg_cron` n'a pas pu s'activer automatiquement — l'activer manuellement via
**Database → Extensions** dans le dashboard, puis rejouer `0006_conversation_retention.sql`.

Dans **Authentication → Providers → Email**, désactive "Confirm email"
pour le pilote (évite la friction de confirmation pendant les tests) —
voir le README pour le détail.

---

## 3. Vercel — déployer l'app

1. Importer le repo GitHub dans Vercel (Next.js détecté automatiquement,
   aucune config `vercel.json` nécessaire).
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
| `OPENAI_API_KEY` | platform.openai.com, avec facturation active |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` (défaut) |
| `OPENAI_CHAT_MODEL` | `gpt-5.6-luna` (défaut, ou un modèle plus cher si besoin de qualité) |
| `CONVERSATION_ENCRYPTION_KEY` | `openssl rand -base64 32` — **si plusieurs environnements partagent la même base Supabase, cette clé doit être strictement identique partout**, sinon les messages chiffrés sur l'un deviennent illisibles depuis l'autre |
| `NEXT_PUBLIC_SUPPORT_CHATBOT_ID` | Optionnel — voir `docs/integration.md` |

3. Déployer. Vercel gère `waitUntil`/`maxDuration` (déjà configurés dans
   le code pour l'ingestion async et le streaming de chat) nativement.

---

## 4. Vérification post-déploiement

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

## 5. Avant d'onboarder un vrai client externe (pas juste toi en test)

Voir `docs/rgpd-conformite.md` — mention à afficher aux visiteurs du
widget + gabarit de DPA à faire signer. Pas strictement bloquant pour
*toi* qui testes en interne, mais requis dès qu'un vrai visiteur externe
discute avec le bot (RGPD).
