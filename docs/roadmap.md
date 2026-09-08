# Roadmap technique : optimisations & évolutions

Backlog des améliorations identifiées mais non implémentées. Pas de date
fixe — sert de mémoire centralisée plutôt que de planning strict.

## Vue d'ensemble

| # | Domaine | Item | Effort | Dépend de |
|---|---|---|---|---|
| 1 | RAG | Seuil de score dynamique (remplace `topK` fixe) | Faible | ✅ Fait |
| 2 | RAG | Reformulation de requête (query rewriting) | Moyen | ✅ Fait |
| 3 | RAG | Agent unique topK + reformulation | Moyen | 1, 2 (fallback si insuffisants) |
| 4 | RAG | Reranking post-récupération | Moyen | Piste : à regrouper avec 18 en offre premium |
| 5 | RAG | Chunking sémantique (par section) | Moyen | ✅ Fait |
| 6 | Ingestion | Traitement asynchrone (queue) | Élevé | ✅ Fait (version légère) |
| 7 | Ingestion | OCR pour PDF scannés | Élevé | — |
| 8 | Ingestion | Formats CSV / Excel | Moyen | — |
| 9 | Chat | Historique de conversation persistant | Moyen | — |
| 10 | Chat | Rate limiting (surtout `/api/public-chat`) | Faible | ✅ Fait |
| 11 | LLM | Bascule génération vers OpenAI | Faible | ✅ Fait |
| 12 | Compte | Changement d'email | Faible (code) | SMTP externe |
| 13 | Compte | Invitation par email (nouveaux comptes) | Faible (code) | SMTP externe |
| 14 | Infra | Self-host Supabase (VPS) | Élevé | VPS provisionné |
| 15 | Qualité | Tests automatisés | Élevé | — |
| 16 | Qualité | Logs locaux (debug/incident) | Faible | ✅ Fait (voir note) |
| 17 | Qualité | Suivi d'usage/coût par org | Moyen | — |
| 18 | Premium | Indexation assistée par IA (doc bruts + URL) | Élevé | 6 (async), entitlement par plan |
| 19 | Templates | Clarifier dans le front que les templates ne sont pas liés en live aux chatbots | Faible | À activer seulement si ça pose problème en usage réel |

---

## 0. Fonctionnalité premium : indexation assistée par IA (item 18)

Idée : remplacer (en option payante) le chunking mécanique par un passage
LLM qui nettoie, structure et segmente intelligemment un document brut ou
une URL avant indexation. Existe déjà chez des acteurs spécialisés
(LlamaParse, Unstructured.io, Reducto) — signe qu'il y a une vraie demande,
pas un besoin inventé.

### Ce que ça change dans le pipeline

Ce n'est **pas** un processus autonome qui tourne en tâche de fond : c'est
une étape conditionnelle dans le pipeline d'ingestion existant
(`lib/ingest.ts`). Le déclencheur reste le même qu'aujourd'hui (un upload,
ou une soumission d'URL) ; seule la fonction appelée change selon un flag.

1. **Nouveau flag** `use_ai_indexing` (au niveau organisation ou chatbot),
   activé selon le plan tarifaire.
2. **Nouveau module** (ex. `lib/aiIndexing.ts`) : prend le texte brut extrait,
   demande à un LLM économique de nettoyer (retirer nav/footer/pubs sur du
   contenu web scrapé, en-têtes répétés sur un PDF), segmenter en respectant
   les frontières logiques (une FAQ reste groupée, un tableau reste intact),
   et retourne une sortie **structurée** (JSON, pas du texte libre) via les
   structured outputs de l'API plutôt que du texte à parser à la main.
3. **Fallback obligatoire** : si l'appel LLM échoue ou renvoie un JSON
   invalide, retomber sur le chunker classique (`lib/chunking.ts`) plutôt que
   de faire échouer tout l'upload.
4. **Gestion des gros documents** : découper le texte brut en lots (ex.
   ~50k caractères) traités séquentiellement ou en parallèle si le document
   dépasse la fenêtre de contexte du modèle, puis concaténer les résultats.
5. **Nouveauté à ne pas sous-estimer : l'ingestion par URL n'existe pas du
   tout aujourd'hui** (upload de fichier uniquement). L'inclure veut dire
   ajouter un scraping serveur (fetch + extraction du contenu principal,
   proche d'une extraction type "reader mode") avant de réutiliser la même
   étape de structuration IA. C'est une fonctionnalité à part entière, pas
   juste une amélioration du chunking existant.

### Avantages

- **Différenciateur réel** : la qualité d'ingestion est souvent le vrai
  goulot d'étranglement d'un RAG médiocre, plus que le choix du modèle de
  génération. Deux produits avec le même LLM de génération auront une
  qualité perçue très différente selon la qualité du chunking en amont.
- **Baisse la barrière à l'entrée client** : un utilisateur qui uploade un
  PDF brut mal formaté n'a rien à préparer — argument de vente direct
  ("uploadez, on s'occupe du reste").
- **Justifie un tarif premium** : contrairement au reste du produit, le coût
  marginal réel (appels LLM) rend un modèle payant naturel plutôt qu'artificiel.

### Inconvénients / risques

- **Coût qui scale avec le volume** : contrairement au reste du pipeline
  (embeddings, quasi gratuits), chaque document traité consomme un appel LLM
  non négligeable — nécessite une facturation à l'usage, pas un forfait plat
  (voir estimation ci-dessous).
- **Latence d'ingestion plus longue** : un document qui prenait quelques
  secondes à indexer peut prendre significativement plus longtemps —
  renforce le besoin de l'item 6 (traitement asynchrone) qui était déjà
  dans le backlog sans être urgent ; devient un prérequis réel avec cette
  fonctionnalité.
- **Robustesse** : PDF scanné de mauvaise qualité, URL qui bloque le
  scraping (robots.txt, contenu généré en JS côté client), documents énormes
  — chaque cas doit avoir un comportement de repli propre, pas un échec sec.
- **Sortie non déterministe** : un LLM peut segmenter différemment le même
  document d'une exécution à l'autre — moins prévisible qu'un chunking
  mécanique, à documenter clairement pour l'utilisateur.

### Estimation de coût (Claude Haiku 4.5 : $1/1M tokens input, $5/1M output)

| Taille document | Tokens bruts (approx) | Coût estimé par document |
|---|---|---|
| Court (~5 pages) | ~3 500 | ~0,02 € |
| Moyen (~10 pages) | ~7 000 | ~0,05 € |
| Long (~50 pages, traité en 5 lots) | ~35 000 | ~0,25 € |

Largement compatible avec une facturation à l'usage (ex. "+0,10€ par
document indexé en mode IA", avec marge confortable même sur un document
long). À valider avec des documents réels une fois le prototype en place —
ces chiffres supposent une sortie structurée d'une taille comparable au
texte source, à mesurer en pratique.

### Mode "avec/sans contrôle humain"

Idée reprise de la discussion : proposer un mode "auto-publish" (indexation
immédiate) pour les utilisateurs pressés, et un mode "validation avant
indexation" (le résultat structuré est présenté avant d'être vectorisé) pour
les cas plus sensibles. Bonne piste produit, mais ajoute une UI de review
(afficher les chunks proposés, accepter/modifier/rejeter) — à chiffrer
séparément si retenu.

---

## 1. RAG : récupération de contexte

Ordre de priorité recommandé : **1 → 2 → 4/5 → 3 en dernier recours**, pour
rester sur des changements sans latence ajoutée le plus longtemps possible
avant d'introduire un appel LLM supplémentaire dans le chemin critique.

### 1. Seuil de score dynamique (remplace `topK` fixe) — ✅ fait

**Ce qui a été fait** : `hybridSearch()` (`lib/elasticsearch.ts`) ne prend
plus un `topK` fixe. Elle récupère un pool de candidats (jusqu'à
`CANDIDATE_POOL_SIZE = 15`), fusionne via RRF comme avant, puis garde tous
les chunks dont le score fusionné est au moins `MIN_SCORE_RATIO = 0.6`
(60%) du score du meilleur résultat — plafonné à 15. Les deux constantes
sont ajustables en tête de fichier. Les deux routes de chat
(`app/api/chat/route.ts`, `app/api/public-chat/route.ts`) n'imposent plus de
`topK`, elles utilisent les valeurs par défaut.

**Validé en réel** : testé sur le chatbot support (`/api/public-chat`) —
question ciblée → 3 chunks retournés (au lieu des 5 fixes d'avant).
Pas encore possible de valider "question large = plus de chunks" faute de
base documentaire assez fournie pour ce chatbot de test (seulement 4 chunks
au total indexés) — à revalider une fois un chatbot avec plus de contenu
varié disponible.

**Note sur le choix de 0.6** : la courbe de score RRF est volontairement
plate (différence faible entre rang 1 et rang 15), donc `MIN_SCORE_RATIO`
est un réglage empirique, pas une valeur dérivée mathématiquement — à
ajuster si le nombre de chunks retournés semble trop généreux ou trop
restrictif en usage réel.

### 2. Reformulation de requête (query rewriting) — ✅ fait

**Ce qui a été fait** : `rewriteQuery()` (`lib/openai.ts`) — un appel
`gpt-5.6-luna` avec sortie structurée (JSON Schema, `strict: true`) qui
transforme la question brute en `semanticQuery` (phrase complète pour le
kNN) et `keywordQuery` (termes clés pour BM25). Branché dans
`app/api/chat/route.ts` et `app/api/public-chat/route.ts`, avant l'appel à
`embedText()`/`hybridSearch()`. En cas d'échec (erreur API, JSON invalide,
champs manquants), repli automatique sur la question brute pour les deux —
la reformulation ne peut jamais bloquer le pipeline.

**Pas fait** : la décomposition d'une question à plusieurs volets en
plusieurs sous-requêtes séparées (actuellement, une question à plusieurs
volets donne un seul `keywordQuery` combiné, pas plusieurs recherches). À
ajouter si ça s'avère insuffisant en usage réel.

**Validé en réel** sur le chatbot support : question à deux volets ("ajouter
des gens dans mon équipe" + "changer le nom de mon organisation") →
`semanticQuery`: "Comment ajouter des membres à mon équipe et modifier le
nom de mon organisation ?", `keywordQuery`: "ajouter membres équipe;
modifier nom organisation". Sortie structurée fiable, pipeline complet
réussi (3 chunks, 1 source).

**Compromis à surveiller** : ajoute un appel LLM séquentiel avant chaque
recherche (latence + coût supplémentaires sur chaque message). Pas encore
mesuré précisément en usage réel — à observer via les logs
(`chat.success`/`public-chat.success` incluent maintenant `semanticQuery`
et `keywordQuery`) si le gain de pertinence justifie le coût sur des
questions simples qui n'en ont probablement pas besoin.

### 3. Agent unique topK + reformulation (fallback)

**Idée d'origine** : un agent dédié qui, avant la recherche, détermine à la
fois le nombre de chunks à récupérer (selon la longueur/profondeur de la
question) et reformule la requête pour le kNN/BM25 — probablement en un
seul appel LLM avec une sortie structurée :
```json
{ "topK": 8, "semanticQuery": "...", "keywordQueries": ["...", "..."] }
```

**Pourquoi en dernier recours** : ajoute un appel LLM séquentiel sur *chaque*
message → latence quasi doublée avant même que la réponse commence à
streamer. À ne construire que si les items 1 et 2, moins coûteux, s'avèrent
insuffisants une fois mesurés sur de vrais usages.

### 4. Reranking post-récupération

**Proposition** : passer les chunks candidats par un reranker (cross-encoder)
avant de les envoyer au LLM, pour affiner au-delà de ce que la fusion RRF
(BM25 + kNN) offre seule.

**Effort / compromis** : moyen — latence additionnelle modérée (un modèle de
reranking est généralement plus rapide qu'un appel LLM complet), amélioration
de précision surtout utile si le volume de documents par chatbot grossit.

**Piste produit (2026-09-04)** : plutôt que de l'inclure gratuitement pour
tout le monde, envisager de le regrouper avec l'item 18 (indexation assistée
par IA) dans une offre premium payante — les deux ajoutent un coût réel par
usage (LLM ou reranker), donc la même logique de facturation à l'usage
s'applique aux deux.

### 5. Chunking sémantique — ✅ fait

**Ce qui a été fait** : `lib/chunking.ts` détecte les titres Markdown
(`#`/`##`/...) dans le texte extrait. S'il y en a, il découpe par section
(`chunkByStructure`) : les sections courtes et liées sont regroupées jusqu'à
la taille cible, une section trop grosse à elle seule est sous-découpée
avec l'ancienne méthode par phrases (`chunkBySentences`, gardée comme
fallback ET comme sous-découpeur). Sans titre détecté, tout le texte passe
directement par `chunkBySentences` comme avant.

**Complément côté extraction** : `lib/extract.ts` convertit maintenant les
`.docx` en Markdown (`mammoth.convertToMarkdown`) au lieu de texte brut —
les styles "Titre" de Word deviennent des `#`/`##`, donc les `.docx`
structurés bénéficient aussi du chunking par section, pas seulement les
`.md`. `convertToMarkdown` existe à l'exécution mais n'est pas dans les
types TS officiels de `mammoth` (juste `extractToRawText`/`convertToHtml`),
d'où un cast dans le code.

**Non concerné** : les PDF (`pdf-parse` ne renvoie que du texte brut, aucun
marqueur de titre fiable à exploiter) continuent sur le chunking par
phrases classique — pas de changement pour ce format.

**Validé** : testé en local avec un document synthétique (une grosse
section + plusieurs mini-sections FAQ) — la grosse section sous-découpée
sur 3 chunks sans jamais couper une question/réponse, les mini-FAQ toutes
regroupées dans un seul chunk plutôt qu'éclatées une par une.

---

## 2. Pipeline d'ingestion

### 6. Traitement asynchrone — ✅ Fait (version légère, sans queue)

**Problème** : l'ingestion (extraction → chunk → embeddings → indexation)
tournait de façon synchrone dans la requête d'upload (`lib/ingest.ts`),
bloquant la réponse HTTP jusqu'à la fin. Un document volumineux (PDF de
plusieurs dizaines de pages) pouvait faire timeout, surtout gênant en
pilote réel avec de vrais documents clients — bien plus que dans les tests
avec des petits documents synthétiques.

**Solution implémentée** : pas de vraie queue (Redis/BullMQ) — trop
d'infra pour le besoin actuel. `app/api/documents/upload/route.ts` sauvegarde
le fichier, crée la ligne `documents` (`status: 'pending'`) et répond
immédiatement, pendant que `processDocument` continue en tâche de fond via
`waitUntil` (`@vercel/functions`). `waitUntil` maintient l'invocation en vie
pour la tâche de fond côté Vercel (jusqu'à `maxDuration`) ; sur un serveur
persistant (VPS/self-host), la promesse tourne simplement dans le même
process — fonctionne dans les deux cas sans code conditionnel. Le front
(`DocumentUploader.tsx`) interroge `GET /api/documents/[id]` (nouveau)
toutes les 2s jusqu'à `indexed`/`error` au lieu de bloquer sur une requête
unique.

**Limite connue** : si le process redémarre pendant le traitement (déploi,
crash), le document reste bloqué en `processing` sans reprise automatique —
acceptable pour le pilote (rare, et l'utilisateur peut resupprimer/réuploader),
à revoir avec une vraie queue si ça devient fréquent. Testé : compilation
TypeScript clean, `waitUntil` vérifié en local (tâche de fond exécutée après
le retour de la fonction).

### 7. OCR pour les PDF scannés

**Problème** : un PDF sans texte natif est aujourd'hui rejeté avec un
message clair (voir `lib/extract.ts`), pas de fallback.

**Proposition** : intégrer un moteur OCR.

**Effort / compromis** : élevé — dépendance externe, coût de traitement par
page, gestion de la qualité variable de l'OCR.

### 8. Formats CSV / Excel

**Problème** : hors scope du MVP initial, rejetés à l'upload.

**Effort / compromis** : moyen — extraction relativement simple, mais pose
la question du chunking adapté à des données tabulaires (différent du texte
brut).

---

## 3. Chat

### 9. Historique de conversation persistant

**Problème** : le chat est stateless côté serveur — l'historique vit dans le
state React du navigateur, perdu au rechargement. Pas de table
`conversations`/`messages` en base.

**Effort / compromis** : moyen — nouvelle table + RLS, à faire si le besoin
de retrouver une conversation passée se confirme avec les pilotes.

### 10. Rate limiting — ✅ Fait

**Problème** : aucune limite de débit sur les endpoints de chat, en
particulier `/api/public-chat` qui est public par design (voir
`docs/integration.md`) — n'importe qui connaissant un `chatbotId` pouvait
spammer l'endpoint sans limite (coût OpenAI/ES illimité, DoS trivial).

**Solution implémentée** : limiteur in-memory (`lib/rateLimit.ts`), fenêtre
glissante de 60s, 20 requêtes max par fenêtre. Clé `public-chat:{chatbotId}:{ip}`
sur l'endpoint public (par visiteur, par chatbot) ; clé `chat:{userId}` en
défense en profondeur sur l'endpoint authentifié. Réponse `429` +
header `Retry-After`. Testé en direct : 22 requêtes envoyées, les 20
premières passent (404 attendu, chatbot de test inexistant), la 21e et la
22e sont bloquées en 429 — comportement conforme.

La fenêtre se réinitialise en continu (pas un total à vie) : ~1 message/3s en
rythme soutenu, largement au-dessus du débit d'une conversation humaine
normale, y compris via le widget iframe embarqué.

**Blacklist automatique (2026-09-04)** : un bot malveillant qui tourne en
continu à 20 req/min coûtait quand même en continu (OpenAI + Elasticsearch à
chaque requête acceptée). Ajout d'un blacklist IP : si une même IP épuise la
fenêtre de 20 requêtes deux fois d'affilée (~2 minutes de spam soutenu,
signal quasi impossible à atteindre pour un humain — voir plus haut),
l'IP est bloquée 24h, rejetée en `403` avant toute requête DB/ES/OpenAI.
Événement loggé en `error` (`rateLimit.ip_blacklisted`) pour repérage
immédiat dans le journal local. Testé en direct : 2 fenêtres consécutives
exhaustées → blacklist déclenché, requêtes suivantes bloquées en 403.
Blacklist global par IP (pas par chatbot) pour couvrir la rotation entre
plusieurs `chatbotId` connus. `ip === 'unknown'` (pas de header proxy, ex.
dev local) est explicitement exclu du blacklist pour ne pas bloquer tout le
monde derrière un même proxy qui ne forward pas l'IP.

**Limite connue acceptée pour le pilote** : la clé publique/blacklist est par
IP, donc plusieurs visiteurs légitimes derrière une même IP publique (NAT
d'entreprise, proxy mobile) partagent le même compteur — un cas de faux
positif reste possible si beaucoup de monde derrière la même IP échange
intensément avec le même chatbot en même temps. Idem, le store in-memory
(rate limit et blacklist) ne tient pas si l'app tourne un jour sur plusieurs
instances derrière un load balancer (cf. commentaire en tête de
`lib/rateLimit.ts`) — à revoir avec un store partagé (Redis) si ça arrive.

---

## 4. Modèles LLM

### 11. Bascule génération vers OpenAI — ✅ fait

Décision tranchée et implémentée : la génération de chat tourne maintenant
sur OpenAI (`gpt-5.6-luna` par défaut, configurable via `OPENAI_CHAT_MODEL`)
au lieu de Claude, pour ne facturer que sur une seule plateforme.
`lib/anthropic.ts` est conservé dans le repo (non supprimé, juste inutilisé)
si ce choix doit être révisé plus tard.

**Rappel de la conclusion perf** : pas d'écart significatif pour un contexte
RAG de la taille utilisée ici (~5 chunks, quelques milliers de tokens) — la
fenêtre de contexte plus large des modèles OpenAI ne joue pas à ce volume.
Décision business (simplicité de facturation) plutôt que technique.

---

## 5. Compte / multi-tenant

### 12. Changement d'email · 13. Invitation par email (nouveaux comptes)

**Problème commun** : bloqués par le quota d'envoi d'email de Supabase en
free tier (2 emails/heure).

**Proposition** : brancher un fournisseur SMTP externe (ex. Resend) sur
Supabase Auth. Une fois ça fait, le code applicatif des deux features est
simple (peu d'effort une fois le SMTP en place).

### 14. Self-host Supabase (VPS)

**Contexte** : mis de côté après un bug de facturation Egress sur Supabase
Cloud. Le code est déjà portable (URL/clés en variables d'env, migrations
SQL pures) — le switch reste low-effort le jour où un VPS est provisionné.

---

## 6. Observabilité / qualité

### 15. Tests automatisés

**Problème** : aucun test unitaire ou d'intégration sur le projet à ce
stade.

### 16. Logs locaux (debug/incident) — ✅ fait

**Ce qui a été fait** : `lib/logger.ts` — logs structurés en JSON lines,
un fichier par jour dans `./logs` (ignoré par git, contient parfois des
questions utilisateur). Pas de service tiers, juste `fs.appendFile`. Branché
sur : pipeline d'ingestion (`lib/ingest.ts` : début, chunking, succès,
échec), route d'upload (`app/api/documents/upload/route.ts` : chaque cas
d'erreur), et les deux routes de chat (`app/api/chat/route.ts`,
`app/api/public-chat/route.ts` : requête reçue, chatbot introuvable, succès,
échec).

**Limitation connue** : fonctionne uniquement sur un système de fichiers
persistant (local, VPS). Ne fonctionnerait pas tel quel sur une plateforme
serverless (Vercel) où le filesystem n'est pas durable entre les
invocations — à revoir si migration vers ce type d'hébergement. Pas de
rotation/purge automatique des vieux fichiers de logs pour l'instant.

**Pas fait** : rien de centralisé/interrogeable à distance (pas de Sentry ou
équivalent) — reste un besoin réel si le volume de pilotes grossit, mais
hors scope de cette demande (logs locaux uniquement, pas de service tiers).

### 17. Suivi d'usage/coût par organisation

**Problème** : les paliers de prix affichés sur la landing (nombre de
messages/mois) ne sont pas encore appliqués ni mesurés techniquement — rien
n'empêche aujourd'hui un org de dépasser son palier.

---

## 7. Templates

### 19. Clarifier dans le front que les templates ne sont pas liés en live

**Contexte** : un template (par défaut ou personnalisé) n'est qu'un point de
départ copié dans le champ `system_prompt_template` propre à chaque chatbot
au moment où on l'applique. Modifier un template après coup (page Templates)
ne met **pas** à jour les chatbots qui l'utilisaient déjà — chaque chatbot a
sa propre copie indépendante, pas une référence live.

**Décision actuelle** : comportement volontaire, pas un bug. Pas de UI
spécifique pour l'expliquer pour l'instant.

**À faire si ça pose problème en usage réel** : ajouter une indication
visuelle (ex. dans l'éditeur de prompt du chatbot ou sur la page Templates)
précisant que la modification d'un template ne se propage pas
automatiquement aux chatbots existants.
