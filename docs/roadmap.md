# Roadmap technique : optimisations & évolutions

Backlog des améliorations identifiées mais non implémentées. Pas de date
fixe — sert de mémoire centralisée plutôt que de planning strict.

## Vue d'ensemble

| # | Domaine | Item | Effort | Dépend de |
|---|---|---|---|---|
| 1 | RAG | Seuil de score dynamique (remplace `topK` fixe) | Faible | ✅ Fait |
| 2 | RAG | Reformulation de requête (query rewriting) | Moyen | ✅ Fait |
| 3 | RAG | Agent unique topK + reformulation | Moyen | ❌ Abandonné — rendu obsolète par le reranking (item 4) |
| 4 | RAG | Reranking post-récupération | Moyen | ✅ Fait (LLM, voir `lib/openai.ts` `rerankChunks`) |
| 5 | RAG | Chunking sémantique (par section) | Moyen | ✅ Fait |
| 6 | Ingestion | Traitement asynchrone (queue) | Élevé | ✅ Fait (version légère) |
| 7 | Ingestion | OCR pour PDF scannés | Élevé | ✅ Fait (service Tesseract sur le VPS, PDF scannés + images directes) |
| 8 | Ingestion | Formats CSV / Excel | Moyen | ✅ Fait |
| 9 | Chat | Historique de conversation persistant | Moyen | ✅ Fait (migration à appliquer) |
| 10 | Chat | Rate limiting (surtout `/api/public-chat`) | Faible | ✅ Fait |
| 11 | LLM | Bascule génération vers OpenAI | Faible | ✅ Fait |
| 12 | Compte | Changement d'email | Faible (code) | ✅ Fait (code) — SMTP externe à configurer pour un vrai débit en prod |
| 13 | Compte | Invitation par email (nouveaux comptes) | Faible (code) | ✅ Fait (code) — SMTP externe à configurer pour un vrai débit en prod |
| 14 | Infra | Self-host Supabase (VPS) | Élevé | VPS provisionné |
| 15 | Qualité | Tests automatisés | Élevé | ✅ Fait (fondations) — 10 modules purs couverts (dont `lib/ingest.ts`), routes API elles-mêmes encore ouvertes |
| 16 | Qualité | Logs locaux (debug/incident) | Faible | ✅ Fait (voir note) |
| 17 | Qualité | Suivi d'usage/coût par org | Moyen | Mesure + plan + enforcement réel (item 36) ✅ faits — Stripe ✅ compte test créé, souscription self-service testée en conditions réelles (item 53), prix placeholders à confirmer avant mode live |
| 18 | Premium | Indexation assistée par IA (doc bruts + URL) | Élevé | ✅ Fait (docs uploadés + URL, entitlement par plan inclus) — mode validation humaine avant indexation explicitement hors scope, non fait |
| 19 | Templates | Clarifier dans le front que les templates ne sont pas liés en live aux chatbots | Faible | ✅ Fait (déjà présent dans `SystemPromptEditor.tsx` depuis le 2026-09-09) |
| 20 | RGPD | Plan d'action : rétention/purge, suppression à la demande, chiffrement, logs | Moyen (plan) | A+B+C+D ✅ faits (migrations 0004-0006 à appliquer) — E/F ✅ brouillon fait (`docs/rgpd-conformite.md`), relecture juridique pro encore à faire |
| 39 | RAG | Analyseur français manquant sur l'index Elasticsearch | Moyen | ✅ Fait |
| 40 | Ingestion | Traitement de plusieurs fichiers en simultané | Moyen | ✅ Fait |
| 41 | Chat | Chaîne longue sans espace casse l'affichage dans l'iframe | Faible | ✅ Fait |
| 42 | Infra | Déploiement VPS (ES sécurisé) + Vercel + migrations | Élevé | ✅ Fait et en prod : Vercel déployé, VPS (OVH, Canada/BHS) avec Elasticsearch opérationnel, un chatbot fonctionne déjà sur le dashboard prod et sur un site client — seul le nom de domaine dédié (`corpusia`) manque encore |
| 43 | Compte | Suppression d'un chatbot | Moyen | ✅ Fait |
| 44 | Sécurité | Durcir le garde-fou SSRF de l'ingestion par URL (DNS rebinding + redirection) | Moyen (redirection) / Élevé (DNS rebinding) | Redirection ✅ Fait — DNS rebinding noté, pas implémenté (risque limité tant que réservé aux membres authentifiés) |
| 45 | Qualité | Voir le contenu indexé (chunks) depuis la page Documents | Moyen | ✅ Fait |
| 46 | Chat | Chatbot vocal intégrable via iframe (STT/TTS) | Élevé | Noté, pas implémenté — distinct de l'item 25 (reste dans le widget web) |
| 47 | Chat | Indicateur de chargement du chat trop statique (points fixes) | Faible-moyen | ✅ Fait (rotation animée + personnalisable par chatbot) |
| 48 | Chat | Envoi de fichiers par le visiteur dans le widget (réglable par chatbot) | Moyen-élevé | ✅ Fait (stockage + téléchargement dashboard + pièce jointe de l'email + purge de rétention à 90 jours via Vercel Cron) |
| 49 | Chat | Analyse IA du fichier envoyé (interpréter le contenu et répondre directement) | Élevé | Noté, pas implémenté — dépend de l'item 48 (et de l'OCR, item 7, pour scans/images) |
| 50 | Ingestion | Le scan d'URL ne lit qu'une page, pas le site entier | Moyen | ✅ Fait et testé en prod (option "Tout le site", une page = un document) |
| 51 | Chat | Messages d'attente contextuels (étapes réelles avec le sujet de la question) | Faible-moyen | ✅ Fait et testé en prod (choix par chatbot, désactivé par défaut) |
| 21 | Catalogue | Agent de qualification de leads | Élevé | Item 3 (agent) |
| 22 | Catalogue | Brouillon de réponse email | Moyen | — |
| 23 | Catalogue | Analyseur de contrats (extraction de clauses) | Moyen | ✅ Fait (MVP, 2026-11-09) |
| 24 | Catalogue | Digitaliseur de paperasse (factures, formulaires) | Élevé | Item 7 (OCR) |
| 25 | Catalogue | Standard IA téléphone / WhatsApp | Élevé | Nouveau canal, hors chat web |
| 26 | Catalogue | Agent de veille & synthèse | Élevé | Item 3 (agent) |
| 27 | Catalogue | Réponse automatique aux avis clients | Moyen | — |
| 28 | Catalogue | Coach de simulation (entraînement par scénario) | Élevé | — |
| 29 | Chat | Widget d'intégration prêt à l'emploi (bulle flottante) | Moyen | ✅ Fait |
| 30 | Compte | Suppression d'organisation + gestion des membres (retirer, changer de rôle) | Moyen | ✅ Fait |
| 31 | Sécurité | Restriction de domaine + toggle "chatbot public/privé" pour les embeds | Moyen | ✅ Fait — couvre la limite notée à l'item 29 |
| 32 | RAG | Mode "prompt seul" (chatbot sans document obligatoire) | Faible-moyen | ✅ Fait — même besoin identifié indépendamment côté landing (item 21bis "Assistant sans documents") |
| 33 | Intégrations | Branchement sur plateformes tierces (calendrier, email) | Élevé | Étape 1 (pattern agentique, outil email) ✅ Fait — étape 2 (MCP) et étape 3 (UI config) restent backlog |
| 34 | Pricing | Plan gratuit | Moyen | ✅ Fait (palier `free`, 30 msg/mois, 1 assistant, 1 membre, voir item 56) |
| 35 | Pricing | Calcul réel de coût/rentabilité par message | Moyen | Item 17 (comptage déjà fait) — bloqué sur le $/token réel du modèle |
| 36 | Pricing | Comportement du plan Solo à la limite atteinte | Faible (décision) | ✅ Fait — choix par l'org (bloquer / débit automatique), montants placeholders à confirmer avant prod réelle |
| 37 | Qualité | Résilience du déchiffrement (item 20-C) | Faible | ✅ Fait |
| 38 | Qualité | Aucune page dashboard n'a de gestion d'erreur (try/catch) | Moyen | ✅ Fait |
| 52 | Compte | Séparer dashboard "chatbot widget site" / "assistant interne" | Faible-moyen | ✅ Fait |
| 53 | Pricing | Souscription self-service (Stripe Checkout) depuis l'app | Moyen | ✅ Fait et testé en mode test Stripe |
| 54 | Compte | Mini tuto d'onboarding à la première arrivée sur le dashboard | Faible-moyen | ✅ Fait |
| 55 | Pricing | Changer de palier / gérer son abonnement une fois abonné (portail Stripe) | Faible | ✅ Fait, config portail Stripe (mode test) vérifiée faite, à refaire en mode live |
| 56 | Pricing | Revoir les montants/quotas des paliers (Solo/PME) + restrictions fonctionnelles réelles | Faible à moyen | ✅ Fait (2026-11-05) |
| 57 | Légal | Pages légales (mentions légales/CGU/confidentialité) | Faible | ✅ Fait (brouillon, `app/legal/[slug]/page.tsx`) — rappel : mettre à jour domaine et email une fois le nom de domaine acheté et le déploiement définitif en place (item 42) |
| 58 | Méthode | Méthode de travail inspirée de Spec Kit (spec, clarification, plan avant de coder) + `CLAUDE.md` | Faible | ✅ Fait (`CLAUDE.md` créé) : étapes "clarifier" et "analyser" appliquées aux grosses features, outil Spec Kit non installé |
| 59 | Produit | Retour 👍/👎 sur les réponses + statistiques et questions sans réponse par chatbot | Moyen | ✅ Fait côté code (2026-11-12), migration `0027` à appliquer, à tester |
| 60 | Produit | Personnalisation du widget : logo, nom, message d'accueil, questions suggérées, mention « Propulsé par » selon le plan | Faible-moyen | ✅ Fait côté code (2026-11-12), migration `0028` à appliquer, à tester |
| 61 | Ingestion | Re-scan automatique des pages web indexées (cron quotidien, ré-indexation seulement si le contenu change) | Moyen | ✅ Fait côté code (2026-11-12), migration `0029` à appliquer, à tester |

---

## 0. Fonctionnalité premium : indexation assistée par IA (item 18) — ✅ Fait (partiel, voir "Implémenté" en bas)

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

### Implémenté (2026-10-06)

Le cœur du pipeline (points 1 à 4 ci-dessus), à l'identique de la
conception — **l'ingestion par URL (point 5) et le mode "avec/sans
contrôle humain" restent non faits**, explicitement hors scope : le
roadmap lui-même les qualifie de "fonctionnalité à part entière" et "à
chiffrer séparément", pas une simple extension du chunking.

- **Migration `0012_chatbot_ai_indexing.sql`** : `chatbots.use_ai_indexing`
  (booléen, défaut `false`) — au niveau chatbot, pas organisation, pour
  cohérence avec `use_documents`/`is_public` (granularité déjà choisie
  ailleurs dans le schéma) et pour permettre de l'activer sur un seul
  chatbot aux documents mal formatés sans l'imposer à tous ceux de l'org.
- **`lib/openai.ts`** (`structureChunksWithAI`), pas un nouveau fichier
  `lib/aiIndexing.ts` comme suggéré en brouillon — toutes les routes LLM du
  projet vivent déjà dans ce seul fichier (`rewriteQuery`, `rerankChunks`),
  pas de raison de déroger à la convention ici. Sortie structurée
  (`json_schema`, `strict: true`), texte découpé en lots de ~50k
  caractères (point 4) traités séquentiellement, résultats concatenés.
  Retourne `null` (jamais une exception) si un lot échoue ou renvoie un
  JSON inexploitable — y compris une réponse tronquée par la limite de
  sortie du modèle, qui casse `JSON.parse` et se résout donc par le même
  chemin de repli sans vérification de troncature séparée.
- **`lib/ingest.ts`** : si `use_ai_indexing` est actif, tente
  `structureChunksWithAI` avant d'utiliser le résultat ; `null` (échec) ou
  flag désactivé → repli sur `chunkText` (`lib/chunking.ts`) comme avant —
  point 3 (fallback obligatoire), jamais un upload en échec à cause de ça.
- **Entitlement par plan** (`lib/plans.ts`
  `AI_INDEXING_ALLOWED_PLANS = ['pme', 'metier']`) : vérifié dans
  `app/api/chatbots/[id]/route.ts` seulement à l'activation (pas à la
  désactivation, pour ne pas bloquer un org rétrogradé qui veut l'éteindre)
  — même logique "étiquette souple, pas d'enforcement Stripe réel" que le
  reste du système de plan (item 17).
- **UI** : `components/AiIndexingToggle.tsx`, case à cocher dans la
  section Documents de la page chatbot, désactivée + message explicatif si
  le plan de l'org ne l'autorise pas (vérifié aussi côté serveur, pas
  seulement visuel).

Testé : `tsc --noEmit` propre, 77 tests au vert (6 nouveaux pour
`structureChunksWithAI` — lot unique, filtrage des segments vides, lots
multiples concatenés dans l'ordre, repli si un lot échoue, repli si rien
d'exploitable, repli sur une réponse tronquée/non parseable).

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

### 3. Agent unique topK + reformulation (fallback) — ❌ Abandonné (obsolète)

**Idée d'origine** : un agent dédié qui, avant la recherche, détermine à la
fois le nombre de chunks à récupérer (selon la longueur/profondeur de la
question) et reformule la requête pour le kNN/BM25 — probablement en un
seul appel LLM avec une sortie structurée :
```json
{ "topK": 8, "semanticQuery": "...", "keywordQueries": ["...", "..."] }
```

**Pourquoi en dernier recours (raisonnement d'origine)** : ajoute un appel
LLM séquentiel sur *chaque* message → latence quasi doublée avant même que
la réponse commence à streamer. À ne construire que si les items 1 et 2,
moins coûteux, s'avèrent insuffisants une fois mesurés sur de vrais usages.

**Abandonné (2026-10-06)** : le reranking (item 4, `rerankChunks` dans
`lib/openai.ts`) fait déjà ce travail de raffinage après coup — il juge la
pertinence réelle des chunks candidats et peut en garder moins si la
question est étroite, ce qui couvre l'essentiel du besoin "ajuster le
volume de contexte à la question" sans ajouter un appel LLM *avant* la
recherche en plus de celui d'après. Garder cet item n'apporterait qu'une
optimisation marginale pour un coût de latence réel — pas rentable tant
que rien ne montre que le reranking est insuffisant.

### 4. Reranking post-récupération — ✅ Fait

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

**Décision d'implémentation (2026-09-11)** : première version au LLM déjà
branché (OpenAI, sortie structurée — même pattern que `rewriteQuery` dans
`lib/openai.ts`), pas un service de reranking dédié (Cohere Rerank évalué
et écarté : gratuit seulement en test, interdit en usage commercial selon
leurs CGU, payant sinon — et ajouter un troisième fournisseur irait à
l'encontre de la consolidation déjà décidée sur OpenAI seul). Cohere/Voyage
AI (MongoDB) utilisent le même schéma d'architecture que ce projet
(embeddings pour la récupération large + reranking en deuxième passe plus
coûteuse sur un petit pool de candidats) — confirme que l'approche choisie
est standard dans l'industrie, pas une improvisation.

**À tester plus tard (idée retenue, pas implémentée)** : comparer contre un
vrai **cross-encoder** dédié en auto-hébergé (ex. `bge-reranker` sur
HuggingFace, gratuit, pas de fournisseur tiers à ajouter) — un cross-encoder
encode la question ET le chunk ensemble en une seule passe (contrairement
aux embeddings, encodés séparément puis comparés après coup), donc en
théorie plus précis pour juger la pertinence, mais plus coûteux à faire
tourner par paire. Voir si la différence de qualité/coût par rapport à la
version LLM justifie de l'auto-héberger.

**Implémenté (2026-09-11)** : `rerankChunks` (`lib/openai.ts`), même
pattern que `rewriteQuery` — un appel LLM avec sortie structurée
(`relevantIndices`), numérote les chunks candidats issus de `hybridSearch`
et demande au modèle lesquels aident réellement à répondre à la question
brute, du plus au moins pertinent. Branché juste après `hybridSearch` dans
`app/api/chat/route.ts` et `app/api/public-chat/route.ts` (les deux
endpoints de chat, authentifié et public). Plafonné à 5 chunks
(`RERANK_MAX_CHUNKS`) ; peut aussi renvoyer une liste vide si aucun chunk
n'est jugé pertinent (`buildSystemPrompt` gère déjà ce cas : "Aucun
document pertinent trouvé"). Ne bloque jamais le pipeline : en cas
d'échec/réponse inexploitable, repli sur l'ordre RRF d'origine (plafonné à
5), même logique de tolérance aux pannes que `rewriteQuery`.

Testé : `lib/openai.test.ts` (6 tests — réordonnancement, liste vide,
index invalides/dupliqués ignorés, repli sur échec API, repli sur sortie
inexploitable). 68 tests au vert au total, `tsc --noEmit` propre.

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

### 7. OCR pour les PDF scannés — ✅ Fait

**Problème** : un PDF sans texte natif (scan) était rejeté avec un message
clair (voir `lib/extract.ts`), sans fallback.

**Techno choisie** : Tesseract (OCR open source, gratuit, historiquement
développé par HP puis maintenu par Google ~10 ans). Déploiement en service
interne sur le VPS OVH plutôt qu'en dépendance serverless (Tesseract.js) côté
Vercel — mêmes raisons que le reste de l'infra déjà sur ce VPS
(Elasticsearch) : binaires natifs Linux plus robustes que des dépendances
WASM/canvas fragiles en serverless, zéro dépendance npm ajoutée côté app.

**Solution implémentée** :
- **`ocr-service/`** (nouveau, déployé sur le VPS, pas sur Vercel) :
  serveur HTTP Node natif (`server.js`, zéro dépendance npm), `Dockerfile`
  base `node:20-slim` avec `tesseract-ocr`, `tesseract-ocr-fra`,
  `poppler-utils`. Détection de format par signature binaire (magic bytes :
  `%PDF`, PNG, JPEG, WebP) plutôt que par `Content-Type` déclaré par le
  client. PDF : rasterisation page par page (`pdftoppm`) puis OCR
  (`tesseract`, `fra+eng`) sur chaque page, texte concaténé — plafonné à 50
  pages. Image (PNG/JPG/WebP) : OCR direct sur un seul appel `tesseract`,
  sans passage par `pdftoppm`. Protégé par un secret partagé (`Authorization:
  Bearer`, même pattern que `CRON_SECRET`), `execFile` (jamais `exec`) pour
  tout appel à un binaire externe, plafond de taille de requête (20 Mo).
- **Routage VPS** : réutilise Caddy (déjà en place pour Elasticsearch) pour
  la terminaison TLS. Le VPS n'a qu'un hostname auto-généré par OVH
  (`vps-xxxxx.vps.ovh.ca`), pas de domaine personnalisé permettant des
  sous-domaines arbitraires — routage par **port** plutôt que par
  sous-domaine (`{$ES_DOMAIN}:8443` → service `ocr`), sans dépendance DNS
  supplémentaire. Repasser en sous-domaine (`ocr.<domaine>`) reste possible
  le jour où un domaine personnalisé est acheté (item 42).
- **`lib/ocrService.ts`** (`runOcr`) : `null` si `OCR_SERVICE_URL` non
  configuré (dev local sans le VPS, fallback silencieux) ; sinon appel HTTP
  avec timeout (120s), lève `OcrServiceError` sur échec.
- **`lib/extract.ts`** : la branche PDF scanné et une nouvelle branche
  `image` (détection par extension `.png`/`.jpg`/`.jpeg`/`.webp`) passent
  toutes les deux par `runOcr` avant d'abandonner — texte retourné si
  au-dessus d'un seuil minimal de caractères, sinon
  `UnsupportedDocumentError` avec message mis à jour.
- **Upload direct d'image** : `DocumentUploader.tsx` et le message d'erreur
  de format acceptent maintenant `.png`/`.jpg`/`.jpeg`/`.webp` en plus des
  formats documents — un visiteur peut uploader directement une capture
  d'écran sans la convertir en PDF.

**Bug trouvé et corrigé en prod pendant la validation** : un nom de fichier
avec accent/apostrophe/espaces (`Capture d'écran ....png`) faisait échouer
l'upload (`Invalid key` côté Supabase Storage, qui rejette ces caractères
dans un chemin). Corrigé en réutilisant `sanitizeFilenameForPath`
(`lib/visitorFileRules.ts`, déjà utilisé par le flux de fichiers du widget
visiteur) pour le chemin de stockage, en gardant le nom d'origine intact
pour l'affichage. À cette occasion, les messages d'erreur de
`app/api/documents/upload/route.ts` ont aussi été génériqués côté client
(détail technique conservé uniquement dans les logs via `logError`).

**Effort réel** : élevé, confirmé — nouveau service à opérer (Docker +
Caddy sur le VPS), mais zéro dépendance ajoutée côté app Vercel.

**Validé en prod (2026-10-28)** : PDF scanné et image (PNG) uploadés
directement, OCR réussi, document passé à `indexed`, texte exploitable en
conversation.

### 8. Formats CSV / Excel — ✅ Fait

**Problème** : hors scope du MVP initial, rejetés à l'upload (`.csv`,
`.xlsx`, `.xls`). Bloquant pour tout client dont les documents clés sont
des catalogues produits ou grilles tarifaires plutôt que du texte narratif.

**Solution implémentée** : `lib/extract.ts` parse le CSV (`csv-parse`) ou le
classeur Excel (`xlsx`, une feuille ou plusieurs) en lignes, puis convertit
chaque ligne en un petit bloc Markdown (`### Ligne N` + `- Colonne: valeur`
par champ, `### Feuille — Ligne N` si plusieurs feuilles). Ce Markdown
synthétique passe ensuite tel quel dans le pipeline de chunking existant
(`lib/chunking.ts`) : la stratégie structurelle regroupe plusieurs lignes
par chunk avec leurs en-têtes de colonnes comme contexte, au lieu de
découper à l'aveugle sur un nombre de caractères. Aucune modification du
chunking/embedding/indexation n'a été nécessaire.

**Sécurité** : le paquet `xlsx` sur le registre npm (0.18.5) a deux CVE haute
sévérité connues (pollution de prototype, ReDoS) jamais corrigées côté npm —
SheetJS ne publie les versions patchées que sur son propre CDN. Comme cette
lib parse des fichiers uploadés par des utilisateurs non fiables, installé
depuis `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (patché, 0
vulnérabilité) plutôt que `npm install xlsx`.

**Limite connue** : pensé pour des fichiers de taille pilote (centaines à
quelques milliers de lignes) — un warning est loggé au-delà de 5000 lignes
(`LARGE_SHEET_ROW_WARNING`). Un vrai catalogue de 75 000+ lignes coûterait
cher en appels d'embeddings synchrones et mérite son propre pipeline basé
sur l'API Batch d'OpenAI (~50% moins cher, mais sans garantie de délai —
adapté à une synchro en masse, pas à un upload interactif où le client
attend de pouvoir discuter avec son document tout de suite) plutôt que cet
endpoint d'upload.

### 40. Traitement de plusieurs fichiers en simultané — ✅ Fait

**Signalé (2026-10-05)** : l'upload ne traite qu'un fichier à la fois —
lent dès qu'un client a plusieurs documents à charger d'un coup. En
creusant : le vrai goulot n'était pas le pipeline d'ingestion (déjà
asynchrone par fichier depuis l'item 6, `waitUntil`) mais l'interface —
`<input type="file">` sans `multiple`, un seul fichier sélectionnable à la
fois, obligeant à rouvrir le sélecteur pour chaque document.

**Solution implémentée** : `DocumentUploader.tsx` — `multiple` sur
l'input, tous les fichiers sélectionnés envoyés en parallèle
(`Promise.allSettled`, pas de file d'attente séquentielle) plutôt qu'un
à la fois. Chaque upload est indépendant : un échec sur un fichier
n'affecte pas les autres (erreurs listées individuellement par nom de
fichier). `router.refresh()` appelé dès que chaque fichier est sauvegardé
(pas d'attente de la fin du batch entier) pour faire apparaître sa ligne
dans le tableau au fur et à mesure ; la progression par fichier
(pending/processing/indexed/error) reste visible via le
`DocumentStatusBadge` déjà existant dans ce tableau plutôt que dupliquée
dans le composant d'upload. Aucun changement côté serveur
(`app/api/documents/upload/route.ts`) : chaque requête traitait déjà un
seul fichier de façon asynchrone, paralléliser côté client suffit à
paralléliser le traitement.

**Limite connue acceptée** : aucun plafond de concurrence — uploader 20
fichiers d'un coup lance 20 appels d'embeddings OpenAI en parallèle. Pas
de souci pour un usage pilote (quelques fichiers à la fois) ; à revoir
avec une file à concurrence limitée si des clients uploadent de gros lots
régulièrement.

---

## 3. Chat

### 9. Historique de conversation persistant — ✅ Fait (migration à appliquer)

**Problème** : le chat était stateless côté serveur — l'historique vivait
dans le state React du navigateur, perdu au rechargement de la page.

**Solution implémentée** : tables `conversations`/`messages`
(`supabase/migrations/0004_conversations.sql` + `0005_multiple_conversations.sql`).
Identité = `user_id` pour le chat authentifié du dashboard, `visitor_id`
(UUID généré côté client, stocké en localStorage — `components/ChatWidget.tsx`)
pour le widget public/iframe, qui n'a pas de session Supabase. Le serveur
devient la source de vérité de l'historique : `GET` (sans `conversationId`)
liste les conversations sauvegardées d'un chatbot pour le sélecteur, `GET`
avec `conversationId` recharge ses messages (après vérification de
propriété), `POST` crée une conversation ou continue celle passée en
paramètre, persiste le tour une fois la génération terminée, et renvoie
l'id via un événement SSE `conversation` (le client en a besoin dès le
premier message d'une conversation neuve). `DELETE` supprime une
conversation précise.

**Révision (2026-09-08)** : la première version (0004) faisait "une
conversation par (chatbot, identité)" — "Nouvelle conversation" supprimait
l'ancienne pour repartir à zéro, sans moyen d'y revenir. Ce n'était pas
l'attente : l'utilisateur veut plusieurs conversations par chatbot et
pouvoir switcher entre elles. `0005_multiple_conversations.sql` retire la
contrainte d'unicité, et `ChatWidget.tsx` a un sélecteur (dropdown) listant
les conversations sauvegardées ; "Nouvelle conversation" n'efface plus
l'historique, elle démarre juste un nouveau fil à côté des précédents.

**Sélecteur de conversations** : menu déroulant custom (pas un `<select>`
natif — son menu ouvert rend avec le chrome de l'OS, impossible à styler
finement). Chaque entrée affiche un titre (la première question posée dans
cette conversation, tronquée à 42 caractères) plutôt qu'une date seule ;
`lib/conversations.ts`'s `listConversations` fait une requête
supplémentaire sur `messages` pour récupérer le premier message `user` de
chaque conversation. "+ Nouvelle conversation" est la première entrée du
menu plutôt qu'un bouton séparé.

**RLS** : même pattern transitif que `documents` (scopé via
`chatbots.organization_id`), pas restreint à `user_id = auth.uid()` — un
coéquipier peut voir les conversations de test des autres membres de l'org,
cohérent avec le reste (chatbots/documents déjà partagés à l'échelle de
l'org). Le widget public passe par le client admin (service role, comme le
reste de `/api/public-chat`), jamais par ce RLS — l'appartenance d'une
conversation à un `visitor_id` est vérifiée manuellement côté code à la
place.

**À faire avant que ça fonctionne** : appliquer
`supabase/migrations/0004_conversations.sql` PUIS
`0005_multiple_conversations.sql` sur le projet Supabase (SQL editor du
dashboard, dans cet ordre). `tsc --noEmit` passe ; testé manuellement pour
le flux de base (historique qui survit au rechargement) avant la révision
0005 — le sélecteur multi-conversations reste à valider en conditions
réelles après application de la nouvelle migration.

**Limite connue** : le `visitor_id` est une clé de persistance, pas un
credential — sécurisé par son entropie (UUID v4), pas par une vérification
d'identité. Quelqu'un qui obtient cet UUID peut lire l'historique de ce
visiteur pour ce chatbot ; même modèle de confiance que la plupart des
widgets anonymes (Intercom et équivalents).

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

### 29. Widget d'intégration prêt à l'emploi — ✅ Fait

**Déclencheur (2026-09-09)** : en testant l'embed sur un vrai site externe,
constat que `/embed/[chatbotId]` (page brute, sans chrome) obligeait le
client à coder lui-même la bulle flottante et le toggle — `docs/integration.md`
était d'ailleurs référencé dans plusieurs commentaires du code sans jamais
avoir été écrit.

**Solution implémentée** : `public/widget.js`, un loader vanilla JS servi
statiquement, à coller en une ligne (`<script src=".../widget.js"
data-chatbot-id="...">`). Il crée une iframe pointant vers
`/embed/[chatbotId]?widget=1`, qui rend son propre chrome bulle+toggle
(`components/EmbedBubbleWidget.tsx`). Une iframe ne pouvant pas dessiner
par-dessus le reste de la page hôte, l'ouverture/fermeture est communiquée
à la page parente via `postMessage`, qui redimensionne l'élément iframe en
conséquence (petit cercle fermé, panneau ouvert, plein écran sur mobile).
Le mode brut (`/embed/[chatbotId]` sans `?widget=1`) reste disponible pour
un client qui préfère gérer son propre wrapper — voir `docs/integration.md`
pour les deux options. Testé en direct : `/widget.js` servi (200), le mode
bulle de la page d'embed rend correctement.

**Fix (2026-09-09)** : `app/globals.css` met un `background bg-slate-50`
global sur `body`, hérité par la page d'embed — visible en marge autour du
bouton rond et du panneau (l'iframe étant redimensionnée/arrondie par
`widget.js`, tout ce qui n'est pas couvert par le bouton/panneau doit être
transparent, pas coloré). Corrigé dans `EmbedBubbleWidget.tsx` (force
`background: transparent` sur `html`/`body` au montage). Repéré et signalé
par l'utilisateur en testant l'intégration sur un vrai site externe.

**Limite connue** : pas d'allowlist de domaines — n'importe quel site
connaissant un `chatbotId` peut l'embarquer aujourd'hui, documenté dans
`docs/integration.md`.

**Personnalisation visuelle (2026-10-05)** : `data-primary-color` permet
de recolorer bouton bulle, bouton d'envoi et bulles de message visiteur
(pseudo marque blanche, voir `docs/integration.md`). **Pas fait, idée pour
plus tard** : personnalisation plus poussée (position du widget sur la
page, logo, police) — pas de demande client concrète pour l'instant,
juste noté pour ne pas l'oublier.

### 41. Chaîne longue sans espace casse l'affichage dans l'iframe du chat — ✅ Fait

**Signalé (2026-10-05)** : une adresse email (ou plus généralement une
chaîne longue sans espace — URL, référence...) affichée dans une bulle du
chat ne se coupe pas et casse la mise en page de l'iframe (dépasse la
largeur du panneau au lieu de passer à la ligne).

**Cause** : le conteneur de bulle (`ChatWidget.tsx`, partagé par le chat
authentifié ET l'embed public — `/embed/[chatbotId]` l'importe) avait
`max-w-[80%]` mais rien qui autorise la coupure d'un mot/token sans espace
— ni `whitespace-pre-wrap` (messages utilisateur) ni le rendu Markdown
(réponses, via `ReactMarkdown`) ne forcent la coupure d'une chaîne
ininterrompue. Un item de flexbox sans `overflow-wrap` tend par défaut à
s'élargir à la taille de son contenu même avec un `max-width`.

**Solution implémentée** : `break-words` (Tailwind, `overflow-wrap:
break-word`) ajouté sur le conteneur de bulle lui-même plutôt que sur
chaque élément de contenu séparément (`<p>`, liens Markdown, `<code>`...)
— un seul point de correction couvre les deux rôles (`user`/`assistant`)
et tous les types de contenu rendus dans la bulle.

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

### 12. Changement d'email · 13. Invitation par email (nouveaux comptes) — ✅ Fait

**Problème commun** : bloqués par le quota d'envoi d'email de Supabase en
free tier (2 emails/heure) — code applicatif simple une fois un SMTP
externe branché sur Supabase Auth (ex. Resend, voir `docs/deployment.md`
section 3 pour la config, hors code — Supabase Auth envoie ces emails
lui-même, notre code ne fait qu'appeler son API).

**Solution implémentée** :
- **13 — Invitation** : `app/api/organizations/[id]/members/route.ts`
  (POST) — si aucun compte n'existe pour l'email donné, appelle
  `admin.auth.admin.inviteUserByEmail` (au lieu de renvoyer une 404 comme
  avant) : crée le compte et envoie l'email d'invitation, puis insère
  directement la ligne `users_organizations` (le membre est prêt dès
  qu'il accepte). `TeamMembers.tsx` distingue "Membre ajouté" (compte déjà
  existant) de "Invitation envoyée par email" (nouveau compte).
- **Flux d'acceptation** : un compte invité n'a pas encore de mot de
  passe — seulement cette session unique issue du lien d'invitation. Sans
  rien de plus, la personne atterrirait dans le dashboard sans jamais
  pouvoir se reconnecter ensuite. `app/auth/callback/route.ts` détecte
  `type=invite` dans l'URL de redirection Supabase et renvoie vers la
  nouvelle page `app/(auth)/set-password/page.tsx` (au lieu du dashboard
  directement) pour choisir un mot de passe avant de continuer.
- **12 — Changement d'email** : `components/ChangeEmailForm.tsx` (nouveau,
  même pattern que `ChangePasswordForm.tsx`), intégré dans Paramètres →
  Compte. Appelle `supabase.auth.updateUser({ email })` — Supabase envoie
  une confirmation à la nouvelle adresse (le changement ne prend effet
  qu'après le clic, comportement par défaut "Secure email change").

**Limite connue** : sans SMTP configuré, ces deux features restent
utilisables mais butent sur le quota free tier de Supabase — fonctionnel
pour tester seul, pas pour un vrai pilote avec plusieurs invitations.

Testé : `tsc --noEmit` propre, 68 tests au vert (pas de nouveau test —
logique dépendante de l'API Auth de Supabase, déjà non testée côté
`ChangePasswordForm`/`TeamMembers` existants, même catégorie).

### 14. Self-host Supabase (VPS)

**Contexte** : mis de côté après un bug de facturation Egress sur Supabase
Cloud. Le code est déjà portable (URL/clés en variables d'env, migrations
SQL pures) — le switch reste low-effort le jour où un VPS est provisionné.

---

## 6. Observabilité / qualité

### 15. Tests automatisés — ✅ Fait (fondations)

**Problème** : aucun test unitaire ou d'intégration sur le projet, alors
que la surface construite (ingestion, chat, embed, conversations, usage,
contrôle d'accès) avait grossi au point que chaque vérification se faisait
à la main (curl, scripts jetables) — pas de filet contre une régression
silencieuse en touchant une zone partagée.

**Solution implémentée** : Vitest, **épinglé en 2.1.9** — la 5.x (dernière
au moment de l'install) exige Node ≥22, incompatible avec le Node 18 du
projet ; installer la 5.x plantait au runtime (`Cannot find package 'vite'`)
malgré un `npm install` silencieusement "réussi". `npm test` (une fois) /
`npm run test:watch` (mode watch). `vitest.config.ts` reprend l'alias
`@/*` de `tsconfig.json`.

6 modules purs couverts, tous les fichiers de test co-localisés en
`lib/*.test.ts` :
- `lib/chunking.ts` — stratégie structurelle (headings) vs phrases, overlap,
  repli sur section trop grosse.
- `lib/rateLimit.ts` — fenêtre glissante, reset après expiration, blacklist
  après 2 fenêtres consécutives, `unknown` jamais blacklisté (horloge
  simulée via `vi.useFakeTimers`).
- `lib/embedAccess.ts` — extraction d'origine (Origin puis Referer),
  allowlist vide = pas de restriction, normalisation d'URL.
- `lib/crypto.ts` — aller-retour chiffrement/déchiffrement, passthrough du
  texte legacy en clair, erreurs claires si clé absente/invalide.
- `lib/prompts.ts` — construction du system prompt (avec/sans documents,
  contexte vide).
- `lib/extract.ts` — détection de type de fichier, extraction txt/md/csv/xlsx
  (mono et multi-feuilles), rejets (CSV vide/malformé, classeur vide), plus
  `extractFromUrl` (garde-fou SSRF, revalidation des redirections — item 44).

Depuis complétés avec le même esprit "modules purs, dépendances externes
mockées" : `lib/supabaseResult.ts`, `lib/openai.ts` (`rerankChunks`,
`structureChunksWithAI`), `lib/stripe.ts`, et **`lib/ingest.ts`**
(2026-10-09, `processDocument`/`processUrlDocument` — repli indexation IA
→ chunking mécanique, transitions de statut pending/processing/indexed/
error, Supabase + Elasticsearch + OpenAI tous mockés). Encore ouvert :
les routes API elles-mêmes (auth, RLS, orchestration HTTP) et un vrai test
d'intégration de bout en bout.

**Bug trouvé par les tests, corrigé dans la foulée** : `lib/crypto.ts`
(construit sur l'autre machine) ne reconnaissait pas le chiffrement d'une
chaîne vide comme du vrai ciphertext (le pattern de détection exigeait au
moins un caractère dans le segment de données chiffrées) — un message vide
chiffré se voyait renvoyé tel quel au lieu d'être déchiffré. Edge case
étroit mais réel, corrigé en une ligne (le segment de données accepte
maintenant zéro caractère).

**Pas encore couvert** (documenté, pas de fausse promesse de couverture) :
- `lib/extract.ts` pour `.docx`/`.pdf` — nécessite de vraies fixtures
  binaires (mammoth/pdf-parse), pas construites ici.
- Tout ce qui appelle Supabase/Elasticsearch/OpenAI en direct
  (`lib/conversations.ts`, `lib/elasticsearch.ts`, `lib/openai.ts`,
  `lib/ingest.ts`, `lib/usage.ts`) — tests unitaires avec mocks possibles,
  mais la vraie valeur serait des tests d'intégration contre de vrais
  services (proche de ce que `scripts/smoke-test.mts` fait déjà à la main) —
  décision à prendre plus tard sur l'effort à y mettre.
- Aucune route API (`app/api/**/route.ts`) ni composant React testés —
  hors scope de cette passe "tests unitaires".

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

**Problème initial** : les paliers de prix affichés sur la landing (nombre
de messages/mois) n'étaient ni mesurés ni appliqués techniquement — rien
n'empêchait un org de dépasser son palier.

**Mesure ✅ faite (2026-09-09)** : `lib/usage.ts`
(`getMonthlyMessageCount`) compte les messages assistant du mois en cours
pour un org, à travers `messages` → `conversations` → `chatbots`.

**Idée d'optimisation notée (2026-11-02), pas nécessaire aujourd'hui** :
`getMonthlyMessageCount` relance un `COUNT(*)` indexé (avec jointure) à
chaque appel (à chaque message de chat, et sur le dashboard) plutôt que
de maintenir un compteur incrémental. Volontaire : un `COUNT` direct sur
la table source est plus simple et ne peut pas dériver (pas de risque de
désynchronisation entre un compteur et la réalité) ; un compteur
incrémental ajouterait de la complexité (incrémentation atomique, reset
mensuel, réconciliation en cas de dérive) pour un gain qui ne se justifie
qu'à un volume de messages bien plus élevé qu'aujourd'hui (phase pilote).
À revisiter seulement si ce `COUNT` devient mesurablement lent.

Au passage, discuté si un nettoyage périodique des vieux messages
serait nécessaire à terme pour ne pas tout garder en base indéfiniment —
**déjà le cas** : la purge RGPD existante (item 48, `purgeExpiredConversations`,
Vercel Cron quotidien) supprime les conversations expirées (90 jours par
défaut), et `messages.conversation_id` a `on delete cascade`
(migration `0004_conversations.sql`) — les messages disparaissent donc
automatiquement avec leur conversation, rien de plus à construire pour ça.

**Plan (étiquette, pas facturation) ✅ fait (2026-09-09)** : colonne
`organizations.plan` (`solo`/`pme`/`metier`, défaut `solo` — migration
`0009_organization_plan.sql`), réglable par un admin/owner dans
`Paramètres > Organisation` (`OrgSettingsForm.tsx`). `lib/usage.ts`
(`PLAN_LIMITS`, `PLAN_LABELS`) associe une limite fixe par plan (300/1 500/
`null` pour Métier), reprise des chiffres de la landing. Le dashboard
(`UsageCard` dans `app/dashboard/page.tsx`) affiche "16 / 300", une barre de
progression, et passe en rouge au-delà du seuil.

**Mise à jour (2026-10-30, item 36)** : ce qui suit décrivait un état où
rien n'était réellement bloqué ni le plan protégé — ce n'est plus le cas.
Le quota est maintenant réellement appliqué (`lib/usage.ts` `checkQuota`,
voir item 36 pour le détail) et le sélecteur de plan se verrouille dès
qu'un vrai abonnement Stripe existe — un admin ne peut plus se mettre
"Métier" gratuitement une fois l'org facturée réellement. Reste vrai tant
qu'aucun abonnement Stripe réel n'existe pour l'org (mode pilote facturé
à la main) : le plan reste librement modifiable, par design, pour ne pas
bloquer ce flux manuel.

**Vraie facturation — ✅ terrain préparé (2026-10-05), intégration réelle pas
encore branchée.** Décision explicite : préparer l'infra (schéma +
webhook) sans créer de session de paiement dans l'app — les plans se
vendent via des **Stripe Payment Links** (dashboard Stripe, aucun code),
le webhook se contente de garder `organizations.plan` synchronisé avec ce
qui se passe côté Stripe quelle que soit la façon dont l'abonnement a été
créé.

- Migration `0011_organization_billing.sql` : `organizations.stripe_customer_id`
  / `stripe_subscription_id` / `stripe_subscription_status`.
- `lib/stripe.ts` : client Stripe paresseux (même pattern que
  `getEsClient`/`getOpenAiClient`) + `planForPriceId`, mapping price→plan
  piloté par env vars (`STRIPE_PRICE_SOLO`/`_PME`/`_METIER`) plutôt que
  codé en dur — créer les produits/prix dans Stripe suffira, pas besoin de
  retoucher le code.
- `app/api/webhooks/stripe/route.ts` : vérifie la signature
  (`STRIPE_WEBHOOK_SECRET`), gère `checkout.session.completed` (lit
  `client_reference_id` sur la session — c'est comme ça qu'on sait quel
  org vient de payer, via un paramètre ajouté à la main sur l'URL du
  Payment Link donné à chaque client, sans session de paiement créée par
  notre code), `customer.subscription.updated` (renouvellement,
  changement de palier) et `customer.subscription.deleted` (repli sur le
  plan `solo`, pas de palier gratuit encore — item 34).

**Reste à faire, hors code** : créer le compte Stripe, les
produits/prix, les Payment Links, et le webhook endpoint côté Stripe —
voir `docs/deployment.md` section 4 pour le détail pas à pas. Rien de
tout ça n'est bloquant pour facturer 2-3 clients pilotes à la main en
attendant.

Testé : `tsc --noEmit` propre, 71 tests au vert (3 nouveaux pour
`planForPriceId` — dont un qui a trouvé un vrai bug avant de pousser :
un price_id vide matchait à tort le premier plan dont la variable d'env
n'était pas encore configurée, corrigé).

**Coût réel (pas chiffré)** : le modèle de chat (`gpt-5.6-luna`, configurable
via `OPENAI_CHAT_MODEL`) est trop récent pour qu'une estimation $/token
fiable soit donnée ici plutôt que devinée — contrairement à l'estimation
Claude Haiku 4.5 de l'item 18 (section 0), qui s'appuie sur un tarif public
connu. Avec le comptage de messages maintenant en place, la bonne méthode
est de lire le coût réel sur le dashboard de facturation OpenAI une fois du
trafic réel accumulé, plutôt que d'extrapoler un tarif non vérifié.

---

## 7. Templates

### 19. Clarifier dans le front que les templates ne sont pas liés en live — ✅ Fait

**Contexte** : un template (par défaut ou personnalisé) n'est qu'un point de
départ copié dans le champ `system_prompt_template` propre à chaque chatbot
au moment où on l'applique. Modifier un template après coup (page Templates)
ne met **pas** à jour les chatbots qui l'utilisaient déjà — chaque chatbot a
sa propre copie indépendante, pas une référence live.

**Décision actuelle** : comportement volontaire, pas un bug — chaque
chatbot doit pouvoir diverger librement de son template d'origine
(personnaliser le nom de l'entreprise, le ton...) via
`SystemPromptEditor.tsx`. Une vraie liaison live retirerait cette
personnalisation par chatbot (ou exigerait de gérer un état "divergé du
template", bien plus de complexité pour un problème jamais signalé en
usage réel) — écarté pour cette raison (2026-10-06).

**Fait** : la clarification visuelle existait déjà dans
`SystemPromptEditor.tsx` ("Appliquer un template copie son contenu ici —
modifier le template plus tard ne mettra pas à jour ce chatbot."),
ajoutée le 2026-09-09 — jamais recroisée avec cette entrée du roadmap
avant aujourd'hui. Rien à ajouter.

---

## 8. Conformité RGPD

### 20. Plan d'action RGPD pour le stockage des conversations

**Déclencheur (2026-09-08)** : l'item 9 (historique de conversation
persistant) fait passer les messages de chat d'un état éphémère (state
React, perdu à la fermeture) à un stockage permanent en clair dans Postgres.
Décision du produit : être conforme dès le pilote plutôt que de rattraper
après coup — voici le plan, rien n'est encore implémenté.

**A. Rétention & purge automatique** — ✅ Fait (migration à appliquer).
`supabase/migrations/0006_conversation_retention.sql` : active `pg_cron`
et planifie un `DELETE` quotidien (3h UTC) sur `conversations` où
`updated_at` dépasse 90 jours — `messages` suit automatiquement (cascade
déjà en place). Tourne dans la base elle-même, indépendant de l'hébergement
de l'app (Vercel ou VPS). Durée codée en dur (90 jours) mais changeable
sans nouvelle migration : re-exécuter `cron.schedule(...)` avec le même nom
de job (`purge-old-conversations`) et un nouvel intervalle fait un upsert.
Si `create extension pg_cron` échoue à l'exécution de la migration,
l'activer d'abord via Database > Extensions dans le dashboard Supabase.
Non testé en conditions réelles (nécessite d'attendre l'échéance ou de
vérifier `cron.job_run_details` après application).

**B. Suppression à la demande (droit à l'effacement)** — ✅ fait.
Deux couches : (1) bouton "supprimer" (icône poubelle, au survol) sur
chaque entrée du sélecteur de conversations dans `ChatWidget.tsx`, pour
son propre historique (chat de test authentifié ou widget public via
`visitorId`). (2) Le vrai besoin RGPD — un membre de l'org retrouve et
supprime la conversation **d'un visiteur** qui n'a plus son `visitorId` :
route `app/api/chatbots/[id]/conversations/route.ts` (`GET`/`DELETE`),
fonctions `lib/conversations.ts` (`listAllConversationsForChatbot`,
`deleteConversationForChatbot`) qui ne filtrent que par `chatbot_id`, pas
par identité. Composant `components/ConversationsPanel.tsx` intégré à la
page de chaque chatbot. La suppression de compte utilisateur authentifié
reste couverte architecturalement (`user_id references auth.users(id) on
delete cascade`).

**C. Chiffrement applicatif des messages** — ✅ fait.
`lib/crypto.ts` : `content`/`sources` chiffrés en AES-256-GCM avant
insertion (`encryptText`), déchiffrés à la lecture (`decryptText`) dans
`lib/conversations.ts` — protège contre un accès DB direct (rôle
service-role notamment), en complément du chiffrement au repos déjà géré
par l'infra Supabase (qui protège seulement contre le vol de disque). Clé
dans `CONVERSATION_ENCRYPTION_KEY` (variable d'env, jamais stockée en
base) — générée avec `openssl rand -base64 32`, doit décoder en 32 octets
(AES-256), sinon `getKey()` lève une erreur explicite. Détection des
lignes antérieures à la fonctionnalité (écrites en clair) via
`CIPHERTEXT_PATTERN` — un texte qui ne matche pas le format
`base64:base64:base64` est retourné tel quel plutôt que de faire échouer
le déchiffrement, donc pas de migration de données nécessaire. Compromis
assumé : plus de recherche full-text SQL possible sur le contenu (pas
utilisé aujourd'hui, donc sans coût réel) ; la rotation de clé n'est pas
gérée (à traiter si besoin réel).

**D. Angle mort : les logs locaux** — ✅ Fait.
`lib/logger.ts` (item 16) écrivait la question brute en clair dans
`logs/*.log` (`chat.request`, `public-chat.request`, `query_rewrite.failed`
dans `lib/openai.ts` et `lib/anthropic.ts`, et la reformulation
`semanticQuery`/`keywordQuery` dans `chat.success`/`public-chat.success`).
Retiré partout, remplacé par `questionLength` (nombre de caractères) là où
un signal de debug restait utile. En-tête de `lib/logger.ts` mis à jour
avec la règle : jamais de contenu brut utilisateur/visiteur dans ces
fichiers, qui n'ont ni limite de rétention ni chiffrement.

**Pas encore fait** : la politique de rétention des fichiers de logs
eux-mêmes (purge après X jours) — restait dans le plan initial en
alternative au retrait du contenu, mais retirer le contenu couvre déjà le
risque principal (fuite de messages personnels). La rotation/purge des
fichiers reste une amélioration possible, pas urgente maintenant.

**E. Sous-traitants tiers à documenter** — ✅ brouillon fait (2026-10-05).
**F. Documentation** — ✅ brouillon fait (2026-10-05).
`docs/rgpd-conformite.md` : tableau des sous-traitants (Supabase, OpenAI,
Elasticsearch, Vercel) avec région à vérifier/choisir, registre de
traitement minimal, gabarit de mention pour les visiteurs du widget, et
squelette de DPA client. **Pas un avis juridique** — à faire relire par un
professionnel du droit avant tout usage avec un vrai client payant, mais
débloque le pilote en attendant.

**Ordre proposé** : A + D d'abord (rien n'est conforme sans ça, effort
faible chacun) — ✅ fait le 2026-09-08, migration 0006 à appliquer. Puis B,
puis C en renforcement — tous ✅ faits. E/F : brouillon ✅ fait, relecture
juridique professionnelle encore à faire avant signature d'un vrai client
payant.

---

## 9. Catalogue produit — pistes créatives

**Contexte (2026-09-09)** : suite au repositionnement de la landing (vision
"plateforme pour PME/indépendants", catalogue en deux registres "disponible
aujourd'hui" / "feuille de route"), la page affiche désormais publiquement
des pistes au-delà de ce qui est construit — marquées "à venir", jamais
comme un engagement de délai. Cette section documente ces pistes pour
qu'elles ne restent pas seulement dans le code de la landing. Rien
d'implémenté, aucune date visée.

**Mise à jour (2026-09-09)** : la landing n'affiche plus les 9+9 entrées
d'origine mais une sélection resserrée (6 "disponible" + 6 "feuille de
route") — 18 cartes en une seule section était dense pour un premier
scroll, et plusieurs entrées ("Wiki interne conversationnel", "Assistant
multilingue", "Secrétariat médical virtuel" côté disponible ; "Réponse aux
avis clients", "Coach de simulation", "Digitaliseur de paperasse" côté
feuille de route) étaient soit redondantes avec une autre entrée déjà
affichée, soit déjà couvertes ailleurs sur la page (le multilingue est
listé dans Fonctionnalités). Les items 21-28 ci-dessous restent la liste
complète des idées — le tri n'affecte que ce qui est *affiché*, pas ce qui
est documenté.

### 21. Agent de qualification de leads : ✅ Fait (MVP)

**Idée** : engage un visiteur du widget, pose des questions de
qualification, score le contact et le route — jusqu'à proposer un
rendez-vous. **Dépendait de** l'item 33 (boucle agentique/tool calling),
déjà en place : implémenté comme une extension de cette infra plutôt
qu'un nouveau chantier séparé.

**Décisions prises (2026-11-10)**, avant de coder : un toggle dédié par
chatbot (pas une extension du toggle email existant, pour ne pas mélanger
deux déclenchements différents), un lien de RDV optionnel partagé par le
bot si le lead est jugé chaud, disponible à tous les paliers (comme
l'outil email existant, pas une fonctionnalité premium isolée).

**Implémenté** : nouveau toggle `chatbots.allow_lead_qualification`
(migration `0025_lead_qualification.sql`), plus deux champs optionnels :
`lead_qualification_criteria` (texte libre du propriétaire, ex. "budget
mini 5000€, zone Île-de-France") et `meeting_link` (URL de prise de
RDV, validée côté serveur dans `PATCH /api/chatbots/[id]`). UI :
`components/LeadQualificationToggle.tsx`, section "Widget" de la page du
chatbot (comme `VisitorUploadsToggle`).

Nouvel outil agentique séparé de `notify_bot_owner` (item 33) plutôt
qu'une extension de celui-ci : `createLeadQualificationTool`
(`score_and_route_lead`) dans `lib/agenticTools.ts`, déclenché
proactivement par le modèle (2-3 questions de qualification au fil de la
conversation) et sans dance de confirmation préalable avec le visiteur,
contrairement à `notify_bot_owner` : les deux outils ont des contrats
comportementaux différents (silencieux/proactif vs confirmé/réactif), les
garder séparés évite qu'une seule description d'outil doive satisfaire
les deux à la fois. Branché dans les deux routes de chat (`/api/chat` et
`/api/public-chat`), notes de prompt concaténées quand les deux outils
sont actifs en même temps sur un même chatbot.

**Limite connue du MVP** : pas de vraie prise de RDV automatisée (pas
d'intégration calendrier) : le bot partage un lien externe (Calendly ou
autre) renseigné par le propriétaire, la prise de RDV elle-même se fait
hors produit.

**Testé en conditions réelles (2026-11-10)**, sur un chatbot "Votre
Accompagnateur" (rénovation énergétique, Bordeaux) : conversation visiteur
simulée (projet photovoltaïque, budget, délai, facture annuelle), score
"Chaud" correctement déduit, résumé fidèle à la conversation, coordonnées
marquées "(aucune)" quand le visiteur n'en a pas donné. Logs serveur
confirment que l'outil `score_and_route_lead` est bien appelé par le
modèle à chaque tour une fois un projet concret exprimé, sans qu'il le
mentionne au visiteur.

**Blocage ndd confirmé sur un second point (2026-11-10)** : premier essai
avec l'adresse de notification réelle du propriétaire
(`a.debonnieres@speedmedia.fr`) en échec, Resend répondant 403 ("test
mode", domaine d'envoi non vérifié) : `lib/email.ts` envoie depuis
`no-reply@corpus-ai.fr`, dont le domaine n'est pas encore vérifié sur
resend.com/domains. Tant qu'il ne l'est pas, Resend n'autorise l'envoi
qu'à l'adresse du compte Resend lui-même, pas aux adresses réelles des
propriétaires de chatbot. Testé avec succès en basculant temporairement
l'adresse de notification sur l'adresse du compte Resend. **Le même
blocage ndd déjà identifié pour Stripe (mode live) et le SMTP Supabase
Auth touche donc aussi tout l'outil email agentique (item 33 et celui-ci)**,
pas seulement les deux premiers : rien à corriger côté code, la
vérification de domaine chez Resend suit l'achat du nom de domaine.

### 22. Brouillon de réponse email

**Idée** : à partir d'un email client entrant, rédige un brouillon de
réponse fondé sur la base de connaissance et le ton de marque, à valider
avant envoi. Proche techniquement du chat existant (même pipeline RAG),
la différence est l'interface (email plutôt que widget) et le mode
brouillon-à-valider plutôt que réponse directe.

### 23. Analyseur de contrats : ✅ Fait (MVP)

**Idée** : upload d'un contrat, extraction des clauses clés (structured
outputs, comme `rewriteQuery`), questions-réponses dessus. Peut réutiliser
le pipeline RAG existant presque tel quel, la nouveauté est surtout
l'extraction structurée en amont.

**Décisions prises (2026-11-09)**, avant de coder : un contrat analysé =
une base isolée (pas mélangée avec d'autres contrats ni avec les autres
documents de l'org), réservé au palier PME/Métier, MVP limité à
l'extraction de clauses + chat (pas d'alertes de risque, pas de
comparaison entre contrats).

**Implémenté** : nouveau use_case `contract_analyzer` sur `chatbots`
(migration `0023_contract_analyzer.sql`), capé à un seul document par
analyse (vérifié côté serveur dans `app/api/documents/upload/route.ts`).
Pipeline : `lib/openai.ts` `extractContractClauses` (sortie structurée,
même pattern que `rewriteQuery`/`rerankChunks`, jamais bloquant : un échec
laisse `contract_summary` à null, le chat reste utilisable) déclenchée
depuis `lib/ingest.ts` `processDocument` en parallèle du chunking, de sorte
que le résumé soit prêt au moment où le document passe à `indexed`.

Nouvelle section dashboard `/dashboard/contrats` (liste, upsell si palier
non éligible) et `/dashboard/contrats/[id]` (statut de traitement, fiche
résumé des 9 champs, chat scopé au contrat, suppression). Création en un
clic : `components/CreateContractForm.tsx` crée le chatbot puis uploade le
fichier ; si l'upload échoue, le chatbot vide créé entre-temps est
supprimé plutôt que laissé orphelin.

**Limites connues du MVP** : le texte du contrat est tronqué à 60 000
caractères avant extraction (pas de découpage en lots comme l'indexation
IA, un résumé de clauses ne se fusionne pas lot par lot aussi simplement
qu'une liste de chunks) ; largement suffisant pour un contrat classique,
pas pour un document exceptionnellement long. Pas d'alerte de risque, pas
de comparaison entre contrats, pas d'export (hors scope MVP, voir plus
haut).

Testé : `tsc --noEmit` propre, 176 tests au vert (6 nouveaux pour
`extractContractClauses`), `npm run build` propre (routes `/dashboard/
contrats` et `/dashboard/contrats/[id]` générées). **Testé en conditions
réelles (2026-11-09)** : upload d'un vrai contrat (conditions de vente
EGYPT NILE CRUISES), résumé produit jugé correct par l'utilisateur.
Affinage suite au test : résumé affiché en accordéon repliable (un bloc
fixe de 9 champs en entier était trop lourd visuellement) et titres de
carte tronqués proprement au lieu de déborder.

**Correctif de sécurité découvert en marge (2026-11-09)** : en expliquant
pourquoi ce chatbot n'est pas embarquable, question posée par
l'utilisateur, constat que `chatbots.is_public` vaut `true` par défaut au
niveau colonne (migration 0007, pensé pour `site_widget`). Ni la création
d'un `second_cerveau` (item 52) ni celle d'un `contract_analyzer`
ci-dessus ne le mettaient explicitement à `false` : tout chatbot interne
créé avant ce correctif était donc joignable via l'endpoint anonyme
`/api/public-chat` par quiconque connaissait (ou devinait) son id, alors
même que son interface ne propose jamais de bouton pour le rendre public.
Corrigé à trois niveaux, pas seulement côté front comme demandé par
l'utilisateur : `lib/publicChatAccess.ts` `getAccessibleChatbot` (le seul
point de passage de tous les endpoints anonymes) rejette désormais tout
`use_case` autre que `site_widget`, indépendamment de `is_public` ;
`app/api/chatbots/route.ts` fixe `is_public` explicitement à la création
au lieu de compter sur le défaut de colonne ; `app/api/chatbots/[id]/route.ts`
refuse un `PATCH` qui tenterait de passer un chatbot interne en public.
Migration `0024_private_internal_chatbots.sql` : bascule à `false` les
lignes déjà existantes concernées. Testé : `tsc --noEmit` propre, 181
tests au vert (5 nouveaux pour `getAccessibleChatbot`), `npm run build`
propre.

### 24. Digitaliseur de paperasse : ✅ Fait (MVP)

**Idée** : factures et formulaires papier transformés en données
structurées exploitables. **Dépend de** l'item 7 (OCR) : sans texte
extractible, rien à structurer derrière.

**Décisions prises (2026-11-12)**, avant de coder : contrairement à
l'analyseur de contrats (item 23, un document = une analyse isolée), le
digitaliseur accumule plusieurs documents dans le temps (liste accumulée,
pas un document isolé). Format choisi par le propriétaire à la création
("Facture" : schéma fixe de champs attendus, ou "Libre" : le modèle
identifie lui-même les paires clé/valeur pertinentes), réservé au palier
PME/Métier comme l'analyseur de contrats. MVP sans chat Q&A (pur outil
d'extraction, pas un assistant conversationnel comme le reste du produit)
et sans export CSV/Excel.

**Implémenté** : nouveau use_case `paperwork_digitizer` sur `chatbots` +
colonne `document_format` ('facture'|'libre') + colonne
`documents.extracted_fields` (jsonb, paires label/valeur) (migration
`0026_paperwork_digitizer.sql`). Pipeline : `lib/openai.ts`
`extractDocumentFields` (sortie structurée, même pattern que
`extractContractClauses`, jamais bloquant : un échec laisse
`extracted_fields` à null, le document s'indexe normalement), prompt
système différent selon le format, déclenchée depuis `lib/ingest.ts`
`processDocument` en parallèle du chunking, par document (pas par
chatbot comme `contract_summary`).

Nouvelle section dashboard `/dashboard/paperasse` (liste, upsell si palier
non éligible, création via `components/CreateDigitizerForm.tsx` : nom +
format, sans upload immédiat) et `/dashboard/paperasse/[id]` (upload au
fil du temps via `components/DocumentUploader.tsx` réutilisé tel quel,
une carte par document avec ses champs extraits via
`components/DocumentFieldsList.tsx`, suppression). `components/
ContractStatusPoller.tsx` réutilisé aussi tel quel (une instance par
document en cours de traitement, pas qu'un seul comme pour un contrat).

**Limites connues du MVP** : le texte du document est tronqué à 60 000
caractères avant extraction, comme l'analyseur de contrats. Pas de chat
Q&A, pas d'export, pas de tableau à colonnes dynamiques (une carte par
document plutôt qu'un tableau, pour rester fiable même avec des labels
différents d'un document "Libre" à l'autre).

Testé : `tsc --noEmit` propre, `npx vitest run` au vert (nouveaux tests
pour `extractDocumentFields`, même pattern que `extractContractClauses`),
`npm run build` propre (routes `/dashboard/paperasse` et `/dashboard/
paperasse/[id]` générées). Pas encore testé en conditions réelles (upload
d'un vrai document).

### 25. Standard IA téléphone / WhatsApp

**Idée** : le même assistant, sur un canal vocal ou messagerie plutôt que
le widget web — pour les commerces sans présence web. Chantier à part
entière (intégration téléphonie/WhatsApp Business API), pas une extension
mineure du chat actuel.

**Piste technique notée (2026-10-30)** : pour la partie reconnaissance
vocale (speech-to-text) du canal téléphonique, Whisper (OpenAI,
open-source, gratuit, auto-hébergeable) est un candidat — même logique
d'architecture que le service OCR Tesseract déjà déployé sur le VPS
(item 7) : un petit service interne plutôt qu'une API tierce payante.
Note seulement, pas de décision/implémentation avant que ce chantier soit
repris explicitement.

### 26. Agent de veille & synthèse

**Idée** : surveille un corpus interne ou externe, pousse un résumé
périodique des nouveautés. Suppose un déclenchement planifié (proche de la
purge `pg_cron` de l'item 20) plutôt qu'une réponse à une question posée —
mode "push" inédit dans le produit actuel, entièrement request/response.

### 27. Réponse automatique aux avis clients : déprioritisé (2026-11-12)

**Idée neuve, née de la session de repositionnement** (pas dans le
catalogue initial). Un brouillon de réponse à chaque avis Google ou
Trustpilot, dans le ton de la marque, conforme à la politique interne :
même logique que l'item 22 (brouillon email) appliqué à un canal différent.

**Déprioritisé avant implémentation**, pour deux raisons. (1) Blocage
externe sur l'entrée des avis : l'API Google Business Profile exige une
demande d'accès manuelle (validation Google, quelques jours à quelques
semaines, parfois refusée), et l'API Trustpilot nécessite un compte
Trustpilot Business payant — aucune des deux n'est accessible immédiatement
avec une simple clé comme Resend/Stripe. (2) Sans cette intégration,
l'outil se limite à coller un avis à la main et recopier le brouillon à la
main : une réponse à un avis client est généralement courte et générique,
contrairement à l'item 22 où un email client peut poser une vraie question
factuelle qui justifie d'aller chercher dans la base documentaire. La
valeur ajoutée réelle par rapport à coller l'avis directement dans un
assistant généraliste est jugée trop faible pour justifier le
développement en l'état. Pas supprimé du catalogue produit : à reconsidérer
si l'accès API est obtenu ou si une raison plus solide émerge.

### 28. Coach de simulation

**Idée neuve, née de la session de repositionnement**. Un nouvel employé
s'entraîne face à des scénarios clients réalistes générés à partir des
procédures internes, avant son premier vrai appel — un mode "roleplay"
plutôt que Q&A, nécessite un system prompt et une boucle de conversation
différents de l'assistant documentaire standard.

---

## 10. Sécurité des embeds publics

### 31. Restriction de domaine + toggle "chatbot public/privé" — ✅ fait

**Contexte** : couvre exactement la limite notée à l'item 29 ("pas
d'allowlist de domaines — n'importe quel site connaissant un `chatbotId`
peut l'embarquer") — développé en parallèle sur une autre machine, avant
que le widget `widget.js`/`EmbedBubbleWidget` n'existe, donc la protection
s'applique à `/embed/[chatbotId]` indépendamment du mode (brut ou
`?widget=1`).

**Ce qui a été fait (2026-09-08)** :
1. Colonnes `chatbots.is_public` (défaut `true`) et `chatbots.allowed_origins`
   (`text[]`, défaut vide) — migration `0007_chatbot_embed_controls.sql`.
   Les deux sont opt-in : un chatbot existant reste accessible comme avant
   tant que son propriétaire n'active pas la restriction.
2. `lib/embedAccess.ts` : logique de vérification d'origine
   (`getRequestOrigin`, `isOriginAllowed`, `normalizeOrigin`), sans
   dépendance Node — utilisable depuis une route API (Node) et le
   middleware (Edge runtime).
3. `app/api/public-chat/route.ts` (GET/POST/DELETE) : `getAccessibleChatbot()`
   vérifie `is_public` et l'origine de la requête de façon uniforme sur les
   trois méthodes — chatbot introuvable/privé/origine non autorisée →
   `404` uniformément (pas de distinction visible pour éviter de confirmer
   l'existence d'un chatbot privé).
4. `middleware.ts` : `/embed/[chatbotId]` bascule en `404` si
   `is_public=false`, et pose un header CSP `frame-ancestors` basé sur
   `allowed_origins` au chargement de la page — **c'est le vrai mécanisme
   de restriction pour l'iframe**, pas une vérification d'origine sur l'API.
   Raison technique : le JS qui tourne à l'intérieur de `/embed/[chatbotId]`
   (que ce soit le mode brut ou le chrome bulle de `EmbedBubbleWidget`) est
   servi depuis notre propre domaine, donc ses appels `fetch()` vers
   `/api/public-chat` ont toujours `Origin` = notre domaine, jamais celui
   du site tiers qui embarque l'iframe — un Origin-check seul ne peut pas
   voir qui a chargé la page en iframe, seulement qui a appelé l'API.
5. UI : nouvelle section "Accès public / embed" sur la page de chaque
   chatbot (`components/EmbedSettingsForm.tsx`) — case à cocher public/privé
   + liste de domaines autorisés (un par ligne, vide = aucune restriction).

**Testé** : `tsc --noEmit` et `npm run build` passent (middleware Edge
runtime compatible, pas d'API Node-only importée). Pas encore validé avec
un vrai embed cross-domain en conditions réelles.

**Reste ouvert** : pas de rôles/permissions différents par domaine
autorisé (`allowed_origins` est une liste plate, tout domaine listé a le
même accès) — noté aussi dans `docs/integration.md`.

---

## 11. Mode sans documents

### 32. Mode "prompt seul" (chatbot sans document obligatoire) — ✅ fait

**Constat (2026-09-08)** : chaque template par défaut instruit explicitement
"base-toi STRICTEMENT sur les documents fournis en contexte", et
`buildSystemPrompt` (`lib/prompts.ts`) ajoutait systématiquement "N'utilise
aucune connaissance externe à ces extraits. Si la réponse n'y figure pas,
dis-le clairement." — même sans aucun chunk retrouvé. Résultat : un chatbot
sans document indexé refusait **toute** question, même une FAQ triviale que
le propriétaire aurait pu écrire lui-même dans le prompt (cas typique : un
artisan qui veut un petit chatbot pour son site sans vouloir gérer
d'upload de documents). Le même besoin a été identifié indépendamment côté
landing (catalogue, "Assistant sans documents" — item 21bis) : les deux
sessions convergent sur le même problème.

**Ce qui a été fait** :
1. Nouvelle colonne `chatbots.use_documents` (booléen, défaut `true` —
   comportement historique inchangé pour les chatbots existants).
   Migration `0008_chatbot_no_document_mode.sql`.
2. `buildSystemPrompt()` accepte un paramètre `useDocuments` : à `false`,
   retourne le `system_prompt_template` tel quel, sans wrapper "documents
   comme unique source de vérité" — le prompt devient la seule connaissance
   du modèle.
3. `app/api/chat/route.ts` et `app/api/public-chat/route.ts` : si
   `chatbot.use_documents` est `false`, `rewriteQuery`/`embedText`/
   `hybridSearch` sont entièrement sautés (gain de latence et de coût en
   plus du fix fonctionnel — un appel LLM et un aller-retour Elasticsearch
   en moins par message).
4. Nouveau template par défaut **"Assistant simple (sans documents)"**
   (`lib/prompts.ts`) : pas de langage "documents fournis", structure à
   remplir directement (activité, horaires, contact, FAQ...) — pensé pour
   être utilisé tel quel avec `use_documents=false`.
5. UI : case à cocher "Ce chatbot se base sur des documents à uploader"
   dans `CreateChatbotForm` (à la création) et `SystemPromptEditor` (sur un
   chatbot existant, page `/dashboard/chatbots/[id]`) — décochée, un
   avertissement apparaît dans la section Documents pour rappeler que les
   documents uploadés ne seront pas utilisés tant que le mode est actif.

**Limite connue** : pas de bascule automatique entre les deux modes selon
le contenu réel (ex. passer en mode RAG dès qu'un premier document est
indexé) — le choix reste manuel, pas de détection intelligente. Comportement
jugé prévisible plutôt que "magique" pour l'instant.

---

## 12. Intégrations tierces

### 33. Branchement sur des plateformes annexes (calendrier, email, etc.)

**Idée (2026-09-08)** : au-delà du RAG documentaire, permettre à un chatbot
d'agir — prendre un rendez-vous (Google Calendar/Cal.com), envoyer un email
de suivi, créer une entrée dans un CRM léger — plutôt que seulement
répondre à partir de documents/prompt. Recoupe largement les items 21
(agent de qualification de leads), 25 (standard téléphone/WhatsApp) et 26
(agent de veille) du catalogue produit — plusieurs pistes nées séparément
convergent vers le même besoin : une vraie boucle agentique (tool calling),
pas juste du RAG.

**Pas chiffré** : gros morceau — implique function calling côté LLM
(OpenAI supporte les tool calls), la gestion d'OAuth par intégration et par
organisation (chaque client connecte son propre compte Google/Outlook), et
une UI de configuration par chatbot ("quelles actions cette instance peut
déclencher"). À dimensionner sérieusement avant de s'y engager — pas une
extension mineure du pipeline actuel.

**Décision d'implémentation (2026-10-12)** : passer par **MCP** (Model
Context Protocol) comme mécanisme de connexion plutôt que de coder une
intégration OAuth maison par plateforme. MCP est devenu un standard ouvert
(donné à la Linux Foundation, soutenu par Anthropic/OpenAI/Google/
Microsoft/Amazon), plus de 3000 serveurs MCP publics recensés — brancher
un client MCP une fois rend accessible tout nouvel outil qui expose un
serveur MCP (calendrier, email, CRM...) sans nouveau code d'intégration
par plateforme. Discuté en comparant au positionnement de Mammouth AI
(mode agentique + connecteurs MCP ajoutés mi-2026) — voir aussi item 18
sur l'indexation IA pour le même esprit "standard existant plutôt que
réinventer". Toujours un gros chantier (serveur MCP à héberger ou
consommer, gestion des credentials par organisation, UI de configuration
par chatbot) — la décision porte sur le *mécanisme*, pas sur l'effort,
qui reste élevé.

**Étape 1 — pattern agentique de base — ✅ Fait (2026-10-12), avant MCP.**
Plutôt que d'attaquer MCP directement, validé le mécanisme de function
calling sur une seule action concrète : l'envoi d'un email de suivi —
choisie en premier parce qu'elle ne demande aucun OAuth par organisation
(contrairement à un calendrier), juste une clé API (Resend).

- **`lib/openai.ts`** (`streamAnswer`) : accepte maintenant un paramètre
  `tools` optionnel (type `ChatTool` : nom, description, schéma JSON des
  paramètres, fonction `execute`). Boucle plafonnée à 2 rounds max : le
  round 0 peut appeler un outil (si `tools` est fourni) ; le round 1 ne
  reçoit jamais `tools`, donc ne peut que produire une réponse finale —
  borne la boucle sans compteur explicite. Les deltas de tool call sont
  fragmentés sur plusieurs chunks par l'API (nom et arguments arrivent
  en morceaux) — accumulés par index avant exécution. Rien n'est streamé
  au visiteur tant que le modèle n'a pas décidé s'il appelle un outil ou
  répond directement — **aucune latence ajoutée** pour le cas (largement
  majoritaire) où aucun outil n'est nécessaire.
- **`lib/email.ts`** : envoi transactionnel via l'API REST de Resend —
  distinct de la config SMTP Supabase Auth (`docs/deployment.md` §3, qui
  ne couvre que les emails *de Supabase* — invitations, changement
  d'email). Optionnel (`RESEND_API_KEY`) : sans clé configurée, l'outil
  échoue proprement et le signale au modèle plutôt que de planter l'app.
- **`lib/agenticTools.ts`** (`createSendFollowUpEmailTool`) : le modèle est
  instruit de n'utiliser une adresse que si le visiteur l'a donnée
  explicitement dans la conversation — jamais inventée — et l'adresse est
  revalidée côté serveur (regex) avant tout envoi, l'instruction seule
  n'est pas une garantie suffisante.
- **Opt-in par chatbot** (migration `0014_chatbot_email_tool.sql`,
  `chatbots.allow_email_tool`, défaut `false`) — un chatbot ne doit pas
  se mettre à envoyer des emails au nom de son propriétaire sans que
  celui-ci l'active explicitement. UI : `components/EmailToolToggle.tsx`,
  section "Comportement du chatbot" de la page du chatbot. Branché dans
  les deux routes de chat (`/api/chat` et `/api/public-chat`).

Testé : `tsc --noEmit` propre, 106 tests au vert (14 nouveaux — boucle de
tool calling dans `lib/openai.test.ts`, dont un faux stream OpenAI avec
tool call fragmenté sur plusieurs chunks pour reproduire fidèlement le
comportement réel de l'API ; validation/échec de l'outil email).

**Deux bugs réels trouvés en testant en direct (pas par les tests
unitaires seuls)** :
- Le modèle refusait d'appeler l'outil même proposé : le prompt "réponds
  STRICTEMENT à partir des documents" se lisait comme "aucune action
  permise". Fix : `buildSystemPrompt` (`lib/prompts.ts`) prend un
  `toolsNote` ajouté uniquement quand un outil est actif, qui dit
  explicitement que l'utiliser n'est pas de la "connaissance externe"
  interdite.
- `gpt-5.6-luna` refuse les tool calls combinés à son reasoning effort par
  défaut sur `/v1/chat/completions` ("set reasoning_effort to 'none'") —
  maintenant fixé explicitement, uniquement quand `tools` est fourni.

**Correction de cible (2026-10-12)** : le premier jet envoyait l'email **au
visiteur** (sur demande explicite + adresse qu'il donnait) — peu utile en
pratique, puisque ça ne génère rien d'actionnable pour le propriétaire du
chatbot. Repensé : l'outil **notifie le propriétaire** qu'un visiteur veut
être recontacté, pas l'inverse.

- Renommé `createSendFollowUpEmailTool` → `createNotifyOwnerOfLeadTool`
  (`notify_bot_owner`), `SEND_FOLLOW_UP_EMAIL_PROMPT_NOTE` →
  `NOTIFY_OWNER_PROMPT_NOTE`. Nouveaux paramètres : `visitor_contact`
  (coordonnées données par le visiteur si présentes, chaîne vide sinon)
  et `summary` (ce qu'il recherche) — plus de `to` fourni par le modèle.
- **Déclenchement** : laissé au jugement du modèle plutôt qu'une détection
  par mot-clé en dur côté code — l'instruction du prompt lui dit
  d'utiliser l'outil dès qu'un visiteur exprime vouloir être recontacté
  (mention de vouloir être rappelé, du mot "email"/"contact"...), sans
  exiger qu'il ait donné son adresse (contrairement à la version
  précédente).
- **Destinataire configurable ✅ Fait** (migration
  `0016_chatbot_notification_email.sql`, `chatbots.notification_email`) :
  remplace l'adresse qui était codée en dur dans `lib/agenticTools.ts`
  (`createNotifyOwnerOfLeadTool(ownerEmail, logCtx)`). Saisie dans
  `components/EmailToolToggle.tsx`, format validé côté serveur dans
  `PATCH /api/chatbots/[id]`. Les routes de chat n'exposent l'outil au
  modèle que si `allow_email_tool` est coché **et** qu'une adresse est
  enregistrée — un chatbot existant avec la case cochée reste donc muet
  tant que son propriétaire n'a pas renseigné son adresse. L'ancienne
  adresse reste dans l'historique Git.

Testé : `tsc --noEmit` propre, 114 tests au vert (3 adaptés aux nouveaux
nom/paramètres de l'outil).

**Décision étape 2 (2026-10-12)** : premier serveur MCP = **Google Calendar**,
via un **serveur MCP open source auto-hébergé** (option retenue parmi : serveur
auto-hébergé / service MCP tiers hébergé / OAuth Google intégré à l'app).
Conséquences à garder en tête : le serveur est branché sur **un seul compte
Google** (un seul agenda — suffisant pour le pilote MonAcompagnateur ; plusieurs
clients avec chacun leur agenda demanderaient une instance par agenda ou
l'OAuth intégré à l'app). Manips côté propriétaire : projet Google Cloud + API
Calendar + écran de consentement OAuth (compte en utilisateur de test) +
identifiant OAuth "application de bureau" (JSON), puis lancer le serveur sur le
VPS, l'exposer en HTTPS **avec un jeton d'accès** (comme Elasticsearch derrière
Caddy), et fournir URL + jeton. Piège connu : en mode "Test", l'autorisation
Google expire au bout de ~7 jours — passer l'application en "En production"
(avertissement "non vérifiée" acceptable en usage perso). Le choix exact du
serveur MCP reste à vérifier (le plus maintenu à ce jour) avant de commencer.
Côté code, prévu : `@modelcontextprotocol/sdk` (ajout validé), `lib/mcpClient.ts`
(outils MCP convertis en `ChatTool`), table des serveurs MCP par chatbot (token
chiffré via `lib/crypto.ts`), garde SSRF de l'item 44 sur l'URL saisie, et revoir
le plafond de 2 rounds de la boucle d'outils (un flux calendrier = chercher les
créneaux puis réserver).

**Reste à faire** : étape 2 (brancher un vrai serveur MCP, calendrier en
priorité) et étape 3 (UI de configuration listant les actions autorisées
par chatbot — aujourd'hui un seul outil possible, pas encore un vrai
besoin de sélection).

**Effort** : élevé. Étape 1 faite, étapes 2/3 restent backlog.

---

## 13. Pricing — suite de l'item 17

### 34. Plan gratuit — ✅ Fait (palier réel + quota, pas encore les restrictions fonctionnelles)

**Idée (2026-09-09)** : la landing promet déjà implicitement du gratuit
("Pilote gratuit pour les premières entreprises", "sans carte bancaire pour
démarrer") sans qu'il existe de palier `free` réel dans `organizations.plan`
— aujourd'hui le plus bas est Solo à 9€. Ambiguïté à trancher d'abord :
**palier permanent** (le plus simple, aucune notion d'expiration à gérer,
cohérent avec l'absence actuelle de facturation réelle) vs **essai limité
dans le temps** (14 jours puis bascule/verrouillage — plus proche d'un vrai
funnel SaaS, mais suppose de stocker une date de début d'essai et une
logique de fin, prématuré tant que Stripe n'existe pas).

**Proposition si palier permanent** : très contraint pour borner le risque
de coût (abus par inscriptions jetables) — ex. 1 chatbot, 50 messages/mois,
mode "sans documents" uniquement (item 32 : zéro embedding, zéro appel
Elasticsearch, donc le message le moins cher possible du pipeline) ou un
plafond de documents bas si le RAG complet reste autorisé. Le rate limiting
existant (item 10 : 20 req/min par chatbot+IP, blacklist 24h) protège déjà
`/api/public-chat`, mais pas `/api/chat` (chat de test authentifié) — un
palier gratuit rendrait pertinent d'y appliquer aussi un plafond mensuel
(via `getMonthlyMessageCount`, déjà en place depuis l'item 17).

**Dépend de** : item 36 (comportement à la limite) — un palier gratuit a
exactement le même besoin qu'un Solo qui déborde, juste avec un seuil plus
bas.

**Retour (2026-11-02)**, qui a déclenché le travail ci-dessous : constat
en testant l'app qu'une org non payée tournait avec `plan = 'solo'` par
défaut — **le même quota (300 msg/mois) qu'un vrai client Solo
payant**, aucune incitation réelle à payer. Confirme la direction du
09/09 côté quota (30-50 messages/mois) ; veut aussi, à terme, limiter
**toutes les fonctionnalités** du palier gratuit, pas juste le nombre de
messages (ex. 1 seul chatbot, pas de CSV/Excel...) — **pas fait dans ce
passage**, détail exact encore à définir, hors scope explicitement
reporté ("on vois l'affichage après").

**Implémenté (2026-11-02)** — palier `free` réel avec son propre quota :
- `types/database.ts` : `OrgPlan` devient `'free' | 'solo' | 'pme' |
  'metier'`.
- Migration `0022_organization_free_plan.sql` : défaut de
  `organizations.plan` passé de `'solo'` à `'free'`, contrainte `check`
  étendue. **Backfill ciblé** : seules les orgs à `plan = 'solo'` **sans**
  `stripe_subscription_id` (le vrai cas de bug : jamais payé, jamais
  choisi) basculent vers `'free'` — les orgs mises manuellement en
  PME/Métier par un admin avant Stripe (flux "pilote facturé à la main",
  toujours supporté) ne sont pas touchées.
- `lib/plans.ts` : `PLAN_LIMITS.free = 30` (placeholder, 30 ou 50 à
  trancher définitivement — trivial à changer), `PLAN_LABELS.free =
  'Gratuit'`. `AI_INDEXING_ALLOWED_PLANS` reste `['pme', 'metier']` —
  `free` en était déjà exclu, aucun changement nécessaire là.
- `components/OrgSettingsForm.tsx` : `'free'` ajouté aux cartes Plan,
  mis en avant quand c'est le plan réel de l'org (plus besoin de
  condition spéciale pour éviter de mettre "Solo" en avant à tort — avec
  `free` comme vraie valeur honnête, `plan === p` suffit à nouveau).
- `app/dashboard/page.tsx` : `UsageCard` passe sur le type `OrgPlan`
  générique (acceptait avant seulement `'solo' | 'pme' | 'metier'`
  codé en dur) — le quota "X / 30" s'affiche automatiquement pour un
  org gratuit via `PLAN_LIMITS`, aucune autre page à toucher
  (`checkQuota` était déjà générique sur `OrgPlan`).

Testé : `tsc --noEmit` propre, 170 tests au vert (1 nouveau — `checkQuota`
bloque bien un org `free` à son propre seuil de 30).

**À appliquer en prod** : migration `0022_organization_free_plan.sql`
(vérifier le backfill sur quelques orgs réelles après coup).

**Rendu visuel revu (2026-11-03)**, après retour direct ("c'est
horrible" sur les gros boutons "Souscrire" coincés dans les petites
cartes de Paramètres) : plutôt que de continuer à retoucher la section
compacte de Paramètres, nouvelle page dédiée **`app/dashboard/plan/page.tsx`**
(`/dashboard/plan`) — grille des 4 paliers (Gratuit/Solo/PME/Métier) en
vraies cartes `Card` avec assez d'espace pour nom, quota et action
(badge "Actuel" sur le palier en cours, `SubscribeButton` sur
Solo/PME si pas encore abonné, note "sur devis" pour Métier,
`ManageBillingButton` une seule fois en bas si déjà abonné — pas
dupliqué par carte).

- `components/OrgSettingsForm.tsx` : la section Plan redevient un simple
  résumé ("Palier actuel : X · quota") + lien "Voir les paliers" vers la
  nouvelle page — tout le choix/action en a été retiré, ça allège
  nettement le formulaire de Paramètres.
- `app/api/billing/checkout/route.ts` / `app/api/billing/portal/route.ts` :
  `success_url`/`cancel_url`/`return_url` redirigent maintenant vers
  `/dashboard/plan` plutôt que `/dashboard/settings` — on revient
  logiquement là où l'action a été lancée. La bannière de confirmation
  post-paiement suit le même déplacement.
- `app/dashboard/page.tsx` : le lien "Changer de plan →" de `UsageCard`
  pointe maintenant directement vers `/dashboard/plan`.

Testé : `tsc --noEmit` propre, 170 tests au vert (pas de nouveau test —
uniquement de l'affichage/routage). **Pas encore testé en conditions
réelles.** La landing (pricing public) n'a toujours pas été retouchée
pour ce nouveau palier — hors scope de ce passage.

### 35. Calcul réel de coût/rentabilité par message

**Pourquoi ce n'est pas déjà chiffré** : `DEFAULT_CHAT_MODEL` pointe vers
`gpt-5.6-luna` (`lib/openai.ts`) — un identifiant de modèle sur lequel je
n'ai pas de tarification $/token fiable à date de rédaction, contrairement
à l'estimation Claude Haiku 4.5 de l'item 18 (section 0) qui s'appuie sur
un tarif public connu et vérifiable. Donner un chiffre de rentabilité ici
serait une invention présentée comme un fait — risqué pour une vraie
décision de pricing. Mieux vaut mesurer que deviner.

**Ce qu'il faut réellement pour un calcul fiable** :
1. **Capturer les tokens réels par appel**, pas juste compter les messages
   (ce que fait déjà `getMonthlyMessageCount`, item 17). Les trois appels
   du pipeline par message (`rewriteQuery`, `embedText`, `streamAnswer`)
   renvoient chacun un objet `usage` (tokens prompt/completion) — pour
   `streamAnswer` en mode streaming, ça suppose de passer
   `stream_options: { include_usage: true }` à l'appel OpenAI (paramètre
   existant de l'API, pas encore utilisé dans `lib/openai.ts`).
2. **Stocker ces tokens** (ex. colonnes sur `messages`, ou table dédiée
   `usage_events` séparée si on veut aussi tracer le coût d'ingestion par
   document) plutôt que de les jeter après la requête.
3. **Appliquer un tarif $/token configurable** (variable d'env plutôt que
   codé en dur — les prix changent, et ça évite de re-déployer pour un
   ajustement). Le tarif à renseigner doit venir de la page de tarification
   officielle du modèle réellement utilisé, vérifiée par vous à la date où
   ce calcul sera fait — pas d'un chiffre que j'avance ici sans certitude.
4. **Rentabilité** = (prix du palier ÷ messages inclus) − (coût moyen réel
   par message, mesuré sur du trafic réel, pas estimé). Avec le comptage de
   messages déjà en place (item 17), le plus rapide et le plus fiable
   reste de lire le coût réel sur le dashboard de facturation OpenAI une
   fois un peu de trafic accumulé, en parallèle de l'instrumentation
   ci-dessus pour avoir le détail par message.

**Effort** : moyen — surtout du plomberie (capturer/stocker des champs déjà
renvoyés par l'API), pas de nouvelle dépendance.

**Note (2026-11-05)** : une estimation par budget de tokens (pas une
mesure réelle, cet item reste donc ouvert) a servi à calibrer les
quotas Solo/PME, voir item 56 pour le détail et les hypothèses.

### 36. Comportement du plan Solo à la limite — ✅ Fait

**Décision (2026-10-30)** : au lieu de trancher nous-même entre blocage
dur et dépassement facturé, **c'est l'org elle-même qui choisit** — un
réglage par organisation plutôt qu'un comportement unique imposé.

**Implémenté** :
- **Migration `0020_organization_overage.sql`** :
  `organizations.overage_mode` (`'block' | 'auto_bill'`, défaut `'block'`)
  + table `overage_charges` (ledger d'audit/idempotence : org, mois,
  nombre de tranches facturées, montant, id du PaymentIntent Stripe,
  statut).
- **`lib/usage.ts` `checkQuota`** : bloque réellement (`app/api/chat/route.ts`,
  `app/api/public-chat/route.ts`, réponse `402`) en mode `block` une fois
  `getMonthlyMessageCount` ≥ la limite du plan (`PLAN_LIMITS`, jamais en
  Métier/`null`). En mode `auto_bill`, ne bloque jamais — le dépassement
  est facturé après coup, pas vérifié en synchrone sur le chemin critique
  du chat.
- **`lib/stripe.ts` `chargeOverage`** + **cron quotidien
  `app/api/cron/charge-overage/route.ts`** (même pattern que
  `purge-conversations`, `CRON_SECRET`) : recalcule chaque jour combien de
  tranches de `OVERAGE_BLOCK_SIZE` messages (défaut 100, `lib/plans.ts`)
  auraient dû être facturées ce mois-ci et ne débite que la différence
  avec le ledger `overage_charges` — idempotent, pas de double facturation
  même si le cron tourne plusieurs fois. Réutilise le moyen de paiement
  déjà enregistré via l'abonnement Stripe Payment Link (pas de nouveau
  formulaire de carte à construire).
- **`components/OrgSettingsForm.tsx`** : nouveau réglage (Bloquer / Débit
  automatique), `auto_bill` grisé tant que l'org n'a pas de
  `stripe_customer_id` (jamais payé → pas de moyen de paiement à
  débiter). **Corrige aussi une faille existante** : le sélecteur de plan
  était librement modifiable par n'importe quel admin sans aucun paiement
  réel derrière — maintenant verrouillé (lecture seule) dès qu'un vrai
  abonnement Stripe existe (`stripe_subscription_id` non nul).
- **`UsageCard`** (`app/dashboard/page.tsx`) : message adapté au mode
  choisi, affiche le total déjà débité ce mois-ci si `auto_bill`.

**Montants = placeholders, à confirmer avant prod réelle** :
`OVERAGE_BLOCK_SIZE = 100` messages, `OVERAGE_CHARGE_CENTS = 500` (5€) —
valeurs explicitement non définitives (`lib/plans.ts`), à valider avec de
vrais chiffres business et testées en mode test Stripe avant d'activer
`auto_bill` sur un compte Stripe live.

**Hors scope, pas fait** : self-service upgrade/downgrade via Stripe
Billing Portal (le plan verrouillé n'a qu'une note informative, pas de
bouton d'action) ; palier gratuit (item 34, reporté).

Testé : `tsc --noEmit` propre, 165 tests au vert (9 nouveaux :
`lib/usage.test.ts` pour `checkQuota`, `lib/stripe.test.ts` étendu pour
`chargeOverage` — résolution du moyen de paiement, repli, erreur si
aucun trouvé).

---

## 14. Compte / gestion d'organisation

### 30. Suppression d'organisation + gestion des membres — ✅ fait

**Déclencheur (2026-09-09)** : en nettoyant 6 organisations en double créées
par un bug de formulaire (migration 0009 pas encore appliquée faisant
échouer silencieusement `getUserOrgs()`), suppression faite à la main en
SQL faute d'autre moyen — confirme qu'il manquait une vraie fonctionnalité,
pas juste un nice-to-have.

**Gestion des membres** (`app/api/organizations/[id]/members/[userId]/route.ts`,
nouveau) :
- `PATCH` change le rôle d'un membre (`owner`/`admin`/`member`). Un
  `admin` peut déplacer quelqu'un entre `admin` et `member`, mais seul un
  `owner` peut attribuer ou retirer le rôle `owner` lui-même — empêche un
  admin de s'auto-promouvoir owner via l'API même si l'UI le cache.
  Toujours au moins un `owner` restant : refuse de rétrograder le dernier.
- `DELETE` retire un membre. Owner/admin peuvent retirer quelqu'un d'autre ;
  n'importe qui peut se retirer soi-même ("quitter l'organisation"), sauf
  si c'est le dernier `owner` (doit d'abord transférer le rôle ou supprimer
  l'organisation). Un `admin` ne peut pas retirer un `owner`.
- **Migration `0010_org_member_self_leave.sql`** nécessaire : la policy RLS
  `users_organizations_delete` d'origine n'autorisait que
  `is_org_admin(organization_id)` — bloquait un membre simple qui essaie de
  supprimer sa propre ligne (se retirer). Ajout de `or user_id = auth.uid()`
  à la policy ; la vraie règle métier (jamais retirer le dernier owner)
  reste appliquée côté API avant la tentative de suppression, la policy RLS
  ne fait qu'arrêter de bloquer un cas déjà validé par l'app.
- UI : `TeamMembers.tsx` — sélecteur de rôle inline + bouton
  Retirer/Quitter par ligne, visibilité conditionnée au rôle de l'utilisateur
  courant (transmis depuis `app/dashboard/settings/page.tsx`).

**Suppression d'organisation** (`app/api/organizations/[id]/route.ts`,
nouveau, `DELETE`) :
- Owner uniquement — volontairement plus strict que la policy RLS
  `organizations_delete` (qui autorise aussi `admin`) : supprimer toute une
  organisation mérite la barre la plus haute disponible, pas seulement
  "peut administrer".
- La cascade DB (`on delete cascade`, migration 0001) couvre chatbots,
  documents, conversations, messages, templates personnalisés et
  memberships — mais **pas** les chunks Elasticsearch ni les fichiers
  Supabase Storage, indexés séparément de Postgres. Les deux sont nettoyés
  explicitement avant la suppression de la ligne `organizations` :
  - `lib/elasticsearch.ts` : nouvelle fonction `deleteOrganizationChunks()`
    — un seul `deleteByQuery` sur `organization_id` (le champ existait déjà
    dans le mapping) plutôt que boucler `deleteDocumentChunks()` par
    document.
  - Suppression Storage en un seul appel `.remove([...paths])` (accepte un
    tableau) plutôt qu'un appel par fichier.
  - Best-effort sur les deux (erreur loggée, ne bloque pas la suppression)
    — cohérent avec le même choix déjà fait sur la suppression d'un
    document unique (`app/api/documents/[id]/route.ts`).
- UI : `DeleteOrgSection.tsx` sur `/dashboard/settings`, visible seulement
  pour un `owner`. Confirmation façon GitHub — il faut retaper le nom exact
  de l'organisation avant que le bouton de suppression définitive
  s'active.

**Non géré** : pas de transfert d'ownership en un clic (il faut promouvoir
quelqu'un d'autre en `owner` via le sélecteur de rôle, puis éventuellement
se rétrograder soi-même) — suffisant pour l'usage actuel, une UI dédiée
"transférer la propriété" serait un raffinement, pas un blocage.

**Bug trouvé en marge (2026-09-09) et corrigé** : `/dashboard/settings`
affichait le formulaire d'édition nom/plan à **tout le monde**, y compris
un `member` — qui ne peut pas réellement l'enregistrer (`organizations_update`
exige `is_org_admin`), mais voyait un formulaire fonctionnel qui aurait
échoué avec une erreur RLS peu claire au moment de sauvegarder. Corrigé :
un `member` voit maintenant nom + plan en lecture seule.

**Précision sur le reste de l'app** : cette clarification des rôles ne
concerne que l'organisation et ses membres. Chatbots/documents/templates
gardent le modèle plat déjà en place avant cet item (`0001_init.sql` :
"any org member can read/create/edit; kept simple for the MVP") — un
`member` peut toujours créer/modifier/supprimer des documents et modifier
des chatbots, au même titre qu'un `owner`. Choix assumé, pas un oubli —
à resserrer plus tard si ça pose un problème réel en usage d'équipe.

---

## 10. Résilience et gestion d'erreur

### 37. Résilience du déchiffrement (item 20-C) — ✅ Fait

**Déclencheur (2026-09-11)** : deux machines pointant vers la même base
Supabase, chacune avec un `CONVERSATION_ENCRYPTION_KEY` différent — un
message chiffré sur l'une devient illisible depuis l'autre.
`decryptText` levait une exception dans ce cas, qui remontait jusqu'à
`app/dashboard/chatbots/[id]/page.tsx` (Server Component, aucun
`try/catch`) et faisait planter **toute la page** (500) au lieu de juste
ne pas afficher le message concerné.

**Solution implémentée** : `decryptText` (`lib/crypto.ts`) ne lève plus
jamais d'exception — toute erreur (clé manquante, mauvaise clé, données
corrompues) est attrapée, loggée (`crypto.decrypt_failed`), et remplacée
par `UNREADABLE_PLACEHOLDER` ("[message illisible]"). Corrige aussi un
effet de bord découvert au passage : `decryptStoredMessage`
(`lib/conversations.ts`) faisait `JSON.parse(decryptText(...))` sur le
champ `sources` — un texte de substitution n'est pas du JSON valide, ça
aurait fait planter à nouveau plus loin. Protégé par son propre
`try/catch`, repli sur `sources: null`.

**`encryptText` n'a volontairement pas changé** : chiffrer un *nouveau*
message sans clé valide doit rester bloquant — l'enregistrer en clair par
défaut (faute de pouvoir le chiffrer) serait pire qu'une erreur visible.

Testé : 59 tests passent (2 nouveaux, dont un qui reproduit exactement le
scénario deux-clés-différentes). `tsc --noEmit` propre.

### 38. Aucune page dashboard n'a de gestion d'erreur — ✅ Fait

**Trouvé en auditant l'item 37**, pas spécifique au chiffrement : les 8
pages de `app/dashboard/**/page.tsx` font toutes leurs requêtes Supabase
directement dans le corps du Server Component, sans aucun `try/catch`.
En creusant plus précisément : la vraie cause commune n'est pas "il
manque un try/catch par-ci par-là", c'est que `getCurrentOrg()`
(`lib/org.ts`), appelée par **les 8 pages sans exception**, lève une
erreur volontairement en cas d'échec de requête (bon choix documenté dans
le code : ne jamais confondre "la requête a échoué" avec "l'utilisateur
n'a aucune organisation", ce qui l'enverrait à tort en onboarding et
risquerait de lui faire créer une org en double). Même chose pour
`getMonthlyMessageCount` (`lib/usage.ts`) et toutes les fonctions de
`lib/conversations.ts`. Ces `throw` sont un choix correct, pas le bug —
le vrai trou, c'était l'absence de toute limite pour les attraper
proprement.

**Solution implémentée** : deux couches, pas du `try/catch` répété dans
chaque page (moins propre, plus dur à maintenir de façon cohérente) :

1. **`app/dashboard/error.tsx`** — la limite d'erreur Next.js (mécanisme
   natif prévu pour ça) : un seul fichier couvre automatiquement les 8
   pages du dashboard. Affiche un écran propre ("Une erreur s'est
   produite" + référence + bouton Réessayer) au lieu de l'écran de crash
   brut de Next.js. `app/error.tsx` (racine, pour la landing/auth/embed)
   et `app/global-error.tsx` (dernier recours si le layout racine
   lui-même plante) complètent la couverture.
2. **Logs au point d'origine** : aucune des fonctions qui lèvent une
   erreur (`lib/org.ts`, `lib/usage.ts`, `lib/conversations.ts`) ne
   loguait quoi que ce soit avant de `throw` — en production, Next.js
   masque le vrai message d'erreur au client (seul un `digest` illisible
   est transmis), donc sans log serveur, aucun moyen de savoir ce qui a
   réellement cassé. Un `logError` ajouté juste avant chaque `throw`
   (7 emplacements dans `lib/conversations.ts`, 1 dans `lib/org.ts`, 1
   dans `lib/usage.ts`) — combiné à `error.tsx`, ça donne : la page ne
   plante jamais pour l'utilisateur, et la vraie cause reste toujours
   retrouvable dans les logs locaux.

**Extension (2026-09-11)** : les appels Supabase bruts directement dans
les pages (ex. `documents/page.tsx`) ne levaient jamais d'erreur — en cas
d'échec ils renvoyaient silencieusement une liste vide plutôt qu'une
erreur visible, un problème différent du risque de crash (une vraie panne
se faisait passer pour "0 documents" sans le dire nulle part, pas même
dans les logs). Corrigé avec `lib/supabaseResult.ts` (`logQueryError`) :
un petit helper qui logue l'erreur si présente et renvoie `data` tel
quel — le rendu de la page ne change pas (toujours "liste vide" en cas
d'échec), mais la panne devient traçable dans les logs locaux au lieu de
disparaître. Appliqué aux 8 appels Supabase bruts identifiés dans les
pages du dashboard (`app/dashboard/page.tsx`, `chatbots/page.tsx`,
`chatbots/[id]/page.tsx`, `chatbots/[id]/chat/page.tsx`,
`documents/page.tsx`, `templates/page.tsx`).

Point technique : passer le résultat Supabase (`{data, error}`) tel quel
au helper cassait l'inférence de type générique (le type union discriminé
de Supabase collapsait `T` en `never`) — corrigé en passant `data` et
`error` comme deux arguments séparés plutôt qu'un seul objet.

Testé : `tsc --noEmit` propre, 62 tests au vert (3 nouveaux pour
`logQueryError` lui-même, désormais une fonction pure testée comme le
reste de `lib/`).

### 39. Analyseur français manquant sur l'index Elasticsearch — ✅ Fait

**Déclencheur (2026-09-11)** : bug rencontré sur un autre projet (même
stack ES) — la recherche BM25 ne matchait pas "vacances" avec "vacance"
(singulier/pluriel) ni plus généralement les variantes d'un même mot,
faute de stemming français sur le champ `content`. Vérifié en direct sur
l'index local (`curl localhost:9201/documents_chunks/_mapping`) : le
champ `content` n'avait effectivement aucun analyseur déclaré (analyseur
`standard` par défaut — tokenisation + minuscule seulement, pas de
stemming).

**Solution implémentée** : un analyseur `french_content` explicite
(`lib/elasticsearch.ts`), recette officielle ES déclarée à la main plutôt
que le nom magique `"french"` intégré, pour que le comportement soit
visible dans le code :
- `french_elision` : "l'école" → "école", "d'hiver" → "hiver"...
- `lowercase`
- `french_stop` : retire les mots vides français (le, de, et...)
- `french_stemmer` (variante `light_french`, moins agressive que le
  Snowball complet qui sur-fusionne des mots différents) : "vacances" et
  "vacance" stemment tous deux vers `vacanc`.

**Contrainte ES** : impossible de changer l'analyseur d'un champ déjà
mappé sur un index existant — obligé de créer un nouvel index avec le
nouveau mapping et réindexer dedans. Pour ne plus jamais revivre ça au
prochain changement de mapping, `documents_chunks` est passé d'un index
simple à un **alias** (`CHUNKS_INDEX`) pointant vers un index physique
versionné (`chunksPhysicalIndexName`, ex. `documents_chunks-000001`) — le
reste du code (recherche, indexation, suppression) continue de cibler
`CHUNKS_INDEX` sans rien savoir du changement.

**Migration** : `scripts/migrate-french-analyzer.mts` (usage unique, pas
partie de l'app) — crée le nouvel index avec le mapping français, `_reindex`
les documents existants dedans (réanalyse `content` sous le nouvel
analyseur, copie `embedding` tel quel donc **aucun appel OpenAI
refait**), vérifie que le compte de documents correspond avant de
supprimer l'ancien index, puis crée l'alias. Exécuté sur la base locale
(29 chunks) : migration réussie, compte préservé, mapping vérifié
(`content` → analyseur `french_content`), et testé en direct via
`_analyze` : "vacances" et "vacance" produisent bien le même token.

À faire en production le jour du déploiement : relancer ce script une
fois contre l'index de prod (une seule fois, avant ou juste après le
déploiement du nouveau code — l'app tolère les deux ordres grâce à
l'alias).

### 42. Infrastructure de déploiement (VPS + Vercel) — ✅ Fait

**Déclencheur (2026-10-05)** : aucune infra de production n'existait —
`docker-compose.yml` (sécurité désactivée) est dev-only, pas de doc de
déploiement, rien ne documentait l'application des migrations en prod.

**Solution implémentée** :
- `docker-compose.prod.yml` + `Caddyfile` + `.env.prod.example` : Elasticsearch
  avec authentification activée (`xpack.security.enabled=true`), exposé
  uniquement via Caddy en reverse-proxy (TLS automatique Let's Encrypt) —
  Elasticsearch lui-même n'est jamais exposé directement sur Internet.
- `docs/deployment.md` : guide pas à pas (VPS → Supabase → Vercel), avec
  une checklist migration par migration — aucune des 10 migrations SQL
  n'a de garde anti-double-exécution automatique, mais la plupart sont
  écrites de façon idempotente (`if not exists`/`if exists`) ; documenté
  comment reconnaître sans risque qu'une migration est déjà appliquée
  (erreur `policy already exists` sur 0001-0004 = déjà en place, aucun
  effet si rejouée pour 0005-0010).
- `docs/architecture.md` : schémas Mermaid (composants, flux d'ingestion,
  flux de chat/retrieval, isolation multi-tenant) — vue d'ensemble pour
  onboarder quelqu'un de nouveau sur le projet sans relire tout le code.
- `docs/rgpd-conformite.md` : brouillon des items 20-E/F (sous-traitants,
  registre de traitement, mention visiteur widget, gabarit DPA) — voir
  item 20.

**Mise à jour (2026-10-26)** : entièrement opérationnel en prod. Vercel est
déployé et en ligne (`rag-sass-seven.vercel.app`), les migrations jusqu'à
`0019` sont appliquées, le VPS (OVH, datacenter Canada/BHS) héberge
Elasticsearch et fonctionne — un chatbot répond déjà réellement, aussi bien
depuis le dashboard de prod que depuis le widget embarqué sur un site
client.

**Reste à faire par l'utilisateur** : acheter/configurer le nom de domaine
dédié (`corpusia` ou équivalent, chez OVH) — actuellement sur le domaine
Vercel par défaut. Point secondaire noté en conversation (2026-10-26) : le
VPS est au Canada plutôt qu'en France/UE comme demandé initialement
(latence transatlantique ajoutée pour les visiteurs européens) — pas
bloquant, à corriger plus tard si besoin (OVH ne permet pas de migrer un
VPS existant de datacenter, il faudrait en recommander un).

### 43. Aucun moyen de supprimer un chatbot — ✅ Fait

**Signalé (2026-10-05)** : seules les conversations et les documents
indexés d'un chatbot pouvaient être supprimés individuellement — pas le
chatbot lui-même.

**Solution implémentée**, même schéma que la suppression d'organisation
(item 30) : `DELETE /api/chatbots/[id]` (`app/api/chatbots/[id]/route.ts`)
nettoie d'abord ce que la cascade DB n'atteint pas (chunks Elasticsearch
via la nouvelle `deleteChatbotChunks` dans `lib/elasticsearch.ts`, fichiers
Supabase Storage des documents du chatbot), puis supprime la ligne
`chatbots` — documents/conversations/messages suivent automatiquement
(`on delete cascade`, migrations 0001/0004). `custom_templates` sont
org-level, pas chatbot-level : jamais touchés par cette suppression.

**Autorisation** : repose uniquement sur la policy RLS `chatbots_delete`
(`is_org_admin`) — contrairement à la suppression d'organisation, pas de
vérification applicative plus stricte en plus : supprimer un seul chatbot
est proportionné au niveau admin déjà exigé par la RLS, pas besoin du
même niveau de prudence que supprimer tout un org.

**UI** : `components/DeleteChatbotSection.tsx`, nouvelle "Zone de danger"
sur la page du chatbot (`app/dashboard/chatbots/[id]/page.tsx`) — même
pattern de confirmation que `DeleteOrgSection.tsx` (taper le nom exact du
chatbot pour confirmer), redirige vers `/dashboard/chatbots` après
suppression.

Testé : `tsc --noEmit` propre, 68 tests au vert (pas de nouveau test
dédié — fonction symétrique à `deleteOrganizationChunks`, déjà couverte
par le même type de vérification manuelle que cette dernière à l'époque).

### 44. Durcir le garde-fou SSRF de l'ingestion par URL (item 18) — point 2 ✅ Fait, point 1 ouvert

**Contexte (2026-10-06)** : `extractFromUrl` (`lib/extract.ts`) bloque déjà
les hostnames qui résolvent vers une IP privée/réservée au moment du
check, mais deux angles morts documentés dans le code restaient ouverts —
deux techniques connues pour contourner une protection SSRF par liste
noire, pas des cas limites théoriques.

**Point 2 — suivi de redirection — ✅ Fait (2026-10-09)** : `fetch`
utilise maintenant `redirect: 'manual'` au lieu de `'follow'` — chaque
réponse 3xx est interceptée, son `Location` extrait et résolu (gère aussi
les redirections relatives, ex. `/nouvelle-page`), puis **revérifié par
`assertPublicHostname` avant d'être suivi**, en boucle, plafonné à 5 sauts
(`MAX_REDIRECTS`). Un `Location` manquant, une redirection vers un
protocole non http/https, ou une chaîne trop longue sont tous rejetés
explicitement plutôt que de planter silencieusement. 5 nouveaux tests
prouvent le fix directement (dont un qui aurait réussi à tort avant —
redirection vers `169.254.169.254` maintenant bloquée dès la validation
du saut, sans même déclencher un deuxième `fetch`).

Testé : `tsc --noEmit` propre, 91 tests au vert (31 dans
`lib/extract.test.ts`, dont les 5 nouveaux de revalidation de
redirection).

**Point 1 — DNS rebinding (plus difficile à exploiter, pas corrigé)** : le
hostname est résolu deux fois séparément — une fois par
`assertPublicHostname` (le check), une fois par `fetch()` lui-même (la
vraie connexion). Un attaquant qui contrôle son propre domaine et son
propre serveur DNS peut répondre une IP publique à la première résolution
(passe le check) et une IP interne à la seconde (la vraie requête part en
interne) — des outils publics existent pour automatiser ça (ex.
`rbndr.us`), ce n'est pas qu'une attaque de laboratoire. **Fix proposé,
pas implémenté** : résoudre le hostname **une seule fois**, vérifier que
cette IP est publique, puis forcer la connexion réseau à utiliser
exactement cette IP (ne pas laisser `fetch` re-résoudre tout seul) tout en
gardant le vrai nom de domaine dans l'en-tête `Host` (et en SNI pour le
TLS) pour que le serveur distant serve toujours le bon contenu. En Node,
ça demande un "dispatcher" `undici` personnalisé (la lib sous le capot de
`fetch`) plutôt qu'un appel `fetch()` standard — plus de code, plus de
risque de mal faire le TLS au passage. Plus lourd que le point 2.

**Pourquoi pas fait tout de suite** : les deux restent un risque limité
tant que l'ingestion par URL est réservée à des membres d'organisation
authentifiés (pas un endpoint public anonyme) — acceptable pour le
pilote, mais à corriger avant d'ouvrir cette fonctionnalité plus
largement ou à des comptes moins fiables.

### 45. Voir le contenu indexé (chunks) depuis la page Documents — ✅ Fait

**Signalé (2026-10-07)** : après avoir testé l'ingestion par URL avec
indexation IA, aucun moyen dans l'app de voir le texte réellement indexé
dans Elasticsearch pour un document — seul `chunk_count` (un nombre) est
affiché. Utile pour vérifier la qualité du découpage, surtout avec
l'indexation IA (item 18, sortie non déterministe par nature) où on veut
pouvoir contrôler ce que le modèle a effectivement produit.

**Solution implémentée** : `getDocumentChunks` (`lib/elasticsearch.ts`) —
même filtre `term: { document_id }` que `deleteDocumentChunks`, en
lecture plutôt qu'en suppression, trié par `chunk_index`. Nouvelle route
`GET /api/documents/[id]/chunks` (RLS via le `select` normal sur
`documents` pour la portée multi-tenant, pas le client admin). Côté UI,
`components/ViewChunksButton.tsx` : bouton "Voir le contenu indexé" sur
chaque document indexé (page du chatbot), ouvre une modale chargeant les
chunks à la demande (pas préchargés avec la liste des documents — la
plupart ne sont jamais inspectés) et les affiche dans l'ordre avec leur
numéro de segment.

Testé : `tsc --noEmit` propre, 86 tests au vert (pas de nouveau test —
`getDocumentChunks` est une requête ES simple, symétrique de fonctions
déjà non testées unitairement comme `deleteDocumentChunks`).

### 46. Transcription de réunions (reformulé, ex-"Chatbot vocal intégrable via iframe") : ✅ Fait (MVP)

**Idée d'origine (2026-10-12)**, née de la session de repositionnement
produit/marché : une variante vocale du widget existant, parler au lieu
d'écrire, réponse en voix de synthèse.

**Repensé (2026-11-12)**, avant de coder quoi que ce soit sur cette
première idée : la voix en entrée/sortie sur un widget web a une valeur
réelle mais étroite (parler à voix haute devant son écran est rarement
plus pratique que taper, contrairement à un vrai canal vocal comme le
téléphone, item 25), et n'ouvre aucun nouveau segment de client. Gardée
en note ci-dessous, non retenue pour ce chantier. À la place : enregistrer
une réunion depuis le dashboard, la transcrire et l'indexer automatiquement
dans le RAG, pour l'interroger ensuite en chat écrit normal, comme n'importe
quel autre document. Colle à la thèse du produit ("tes documents → un
chatbot utile") au lieu d'y être orthogonal, zéro blocage externe
(contrairement à l'item 27/Trustpilot ou au canal WhatsApp de l'item 25 :
seulement l'API OpenAI, déjà utilisée partout dans le produit), et marché
déjà validé ailleurs (Otter.ai, Fireflies, Fathom).

**Implémenté** : un enregistrement devient un document comme un autre.
`lib/extract.ts` : nouveau type `'audio'` (`detectFileType` reconnaît
.webm/.mp4/.m4a/.mp3/.wav/.mpga/.mpeg), transcrit via `lib/openai.ts`
`transcribeAudio` (API Whisper, `toFile` + `audio.transcriptions.create`,
français forcé) plutôt que mammoth/pdf-parse/OCR, puis la même suite
chunk/embed/index que tout document. Rejeté avec un message clair
au-delà de 24 Mo (marge sous la limite de 25 Mo de l'API, environ 90
minutes au débit fixé par l'enregistreur) plutôt que de laisser échouer
l'appel à l'API. `components/AudioRecorder.tsx` (nouveau, à côté de
`DocumentUploader`/`UrlUploader` sur la page d'un chatbot) : enregistre
via `MediaRecorder` (débit fixé à 32 kbit/s, arrêt automatique à 90 min),
envoie le résultat à la route d'upload générique comme un fichier normal.
Logique d'upload/polling partagée avec `DocumentUploader` extraite dans
`lib/clientDocumentUpload.ts`. Palier PME/Métier (`AUDIO_TRANSCRIPTION_
ALLOWED_PLANS`, `lib/plans.ts`), vérifié côté serveur dans la route
d'upload (pas seulement dans l'UI) pour qu'un appel direct à l'API ne
contourne pas le palier requis.

**Limites connues du MVP** : enregistrement direct depuis le dashboard
seulement, pas d'intégration Zoom/Teams/Meet (voir note ci-dessous) ;
limite dure de 90 minutes ; aucune diarisation (qui a dit quoi) ; pas de
récupération automatique si l'enregistrement est interrompu en cours de
réunion (reprendre depuis le début).

**Piste explorée mais non retenue : voix en entrée/sortie sur le widget**
(l'idée d'origine). Techniquement faisable sans blocage externe (Whisper
pour l'entrée, un modèle de synthèse vocale pour la sortie, comme noté le
2026-10-30), mais écartée faute de valeur business claire pour un widget
web. À reconsidérer seulement si une vraie demande se manifeste.

**Note pour une v2 éventuelle : intégration directe Zoom/Teams/Meet**,
pour éviter l'étape manuelle d'enregistrement. Probablement du même ordre
de complexité que les blocages rencontrés sur les items 25/27 (validation
d'accès par une plateforme tierce, pas juste une clé API) : Zoom et
Microsoft Teams exposent des apps marketplace avec leur propre processus
de revue/publication, et l'accès aux enregistrements Google Meet passe
par l'API Google Workspace (comptes Google Workspace, pas les comptes
Gmail personnels). Non chiffré, non commencé : à cadrer explicitement si
ce chantier est repris.

**Testé** : `tsc --noEmit` propre, `npx vitest run` au vert (nouveaux tests
pour `transcribeAudio` et la branche audio d'`extractText`), `npm run
build` propre. Pas encore testé en conditions réelles (vrai enregistrement
micro dans le navigateur).

### 47. Indicateur de chargement du chat trop statique — ✅ Fait

**Signalé (2026-10-12)** : pendant la génération de la réponse (3-4
secondes), le seul retour visuel était `<p>···</p>` — trois points fixes,
immobiles, pas terrible en usage réel.

**Solution implémentée** :
- **`lib/loadingMessages.ts`** : `DEFAULT_LOADING_MESSAGES` (neutre et
  professionnel — "Je réfléchis...", "J'analyse votre question...", etc.,
  pas le ton "creating... vibing..." évoqué en discussion : c'est ce que
  verra par défaut n'importe quel visiteur d'un vrai client, pas juste la
  démo Corpus.ai) + `resolveLoadingMessages` (liste custom si non vide,
  sinon repli sur les valeurs par défaut).
- **`components/ChatWidget.tsx`** : nouveau prop `loadingMessages`, rotation
  automatique (`setInterval`, ~1,6s) tant que `loading` est vrai, remise à
  zéro à chaque nouvelle question. `animate-pulse` (Tailwind) en plus du
  texte qui change, pour l'effet "clignote" minimal demandé même si le
  visiteur ne lit pas le texte.
- **Personnalisable par chatbot** (migration `0015_chatbot_loading_messages.sql`,
  `chatbots.loading_messages text[]`, nullable = défaut) — UI
  `components/LoadingMessagesForm.tsx` (textarea, un message par ligne,
  bouton "Revenir aux valeurs par défaut"), section "Comportement du
  chatbot" de la page du chatbot.
- Branché partout où `ChatWidget` est rendu : chat de test authentifié
  (`app/dashboard/chatbots/[id]/chat/page.tsx`), page d'embed brute et
  mode bulle (`app/embed/[chatbotId]/page.tsx` → `EmbedBubbleWidget.tsx`,
  lues via le client admin puisque cette route est anonyme). Le widget
  support interne (`FloatingChatWidget.tsx`) n'a pas été modifié — pas de
  config par chatbot nécessaire pour l'usage interne, il garde les valeurs
  par défaut automatiquement.

Testé : `tsc --noEmit` propre, 114 tests au vert (4 nouveaux pour
`resolveLoadingMessages`).

**Effort** : faible pour le clignotement seul ; moyen pour les messages
alternés custom (nouveau champ de config + UI back-office).   
---

### 48. Envoi de fichiers par le visiteur dans le widget — ✅ Fait

**Besoin (2026-10-12)** : un visiteur doit pouvoir joindre un fichier dans le
chat (ex. une facture d'énergie pour MonAcompagnateur). Périmètre volontairement
limité : le fichier est **enregistré avec la conversation** et, si la
configuration le permet, **joint à l'email de notification du propriétaire**.
Rien ne lit ni n'analyse son contenu (voir item 49).

- **Réglable par chatbot, désactivé par défaut** (migration
  `0017_visitor_file_uploads.sql`, `chatbots.allow_visitor_uploads`) — case à
  cocher `components/VisitorUploadsToggle.tsx`, section "Comportement du
  chatbot". La page d'embed lit le réglage pour afficher le bouton trombone
  (`ChatWidget` prop `allowUploads`), mais l'application réelle est côté
  serveur : `POST /api/public-chat/files` répond 403 si l'option est off.
- **Route d'envoi** : `app/api/public-chat/files/route.ts` (multipart). Même
  modèle de confiance que `/api/public-chat` (chatbotId + `is_public` +
  `allowed_origins` + rate limiting + `visitorId`), la logique d'accès partagée
  vit maintenant dans `lib/publicChatAccess.ts` (une route ne peut pas
  exporter de helper). Si aucune conversation n'est ouverte, l'envoi en crée
  une.
- **Règles** (`lib/visitorFileRules.ts`, partagées widget/serveur) : 4 Mo max
  (Vercel refuse les corps de requête au-delà de 4,5 Mo, l'upload transite par
  notre route), 5 fichiers par conversation, liste blanche d'extensions (pdf,
  png, jpg, jpeg, webp, docx, xlsx, csv, txt). Le `Content-Type` stocké est
  déduit de l'extension, jamais de ce que le client déclare ; le nom de fichier
  est assaini avant d'entrer dans le chemin de stockage.
- **Stockage** : bucket privé `conversation-files`, chemin
  `{organization_id}/{chatbot_id}/{conversation_id}/{id}-{nom}`
  (`lib/conversationFiles.ts`). Chaque fichier crée un message utilisateur
  "Fichier joint : nom" (chiffré comme les autres) + une ligne
  `conversation_files` : l'ordre, l'historique rejoué et le contexte du LLM
  suivent donc le mécanisme de conversation existant. Annulation propre si une
  étape échoue après l'upload (pas d'objet orphelin).
- **Côté propriétaire** : les fichiers apparaissent dans la liste des
  conversations (`ConversationsPanel`), téléchargeables via
  `/api/chatbots/[id]/conversations/files/[fileId]` (URL signée de 60 s ; RLS
  org-membre = contrôle d'accès). Quand l'outil de notification email
  (item 33) est actif **et** que l'option est cochée, les fichiers de la
  conversation sont joints à l'email (`sendEmail` accepte `attachments`).
- **Suppression** : les objets de Storage ne suivent pas le `on delete
  cascade` — nettoyés explicitement avant suppression d'une conversation
  (visiteur ou dashboard), d'un chatbot et d'une organisation
  (`removeConversationFiles`). La suppression visiteur vérifie d'abord que la
  conversation lui appartient.

**Rétention RGPD — ✅ Fait (2026-10-13)** : la purge `pg_cron` (migration
0006) supprimait bien les conversations et les lignes `conversation_files`
en cascade, mais **pas les objets de Storage** — le SQL ne peut pas les
atteindre. Un fichier restait donc stocké pour toujours au-delà des 90
jours annoncés.

Corrigé en déplaçant toute la purge de `pg_cron` vers un **Vercel Cron
Job** (`vercel.json`, quotidien à 3h UTC) :
- `lib/retentionPurge.ts` (`purgeExpiredConversations`) : trouve les
  conversations expirées, nettoie **d'abord** leurs objets Storage
  (`removeConversationFiles`, étendu pour accepter une liste
  `conversationIds` plutôt qu'un seul id ou un chatbot entier), **puis**
  supprime les conversations — l'ordre compte : une fois les conversations
  supprimées, les lignes `conversation_files` (et leur `storage_path`)
  disparaissent en cascade, impossible de retrouver les objets après coup.
- **Les deux mécanismes ne pouvaient pas coexister** : si `pg_cron`
  continuait de tourner en parallèle, il pouvait supprimer une
  conversation avant que le job applicatif n'ait eu la main dessus,
  rendant son fichier introuvable pour toujours. Migration
  `0018_retention_purge_to_vercel_cron.sql` : désinscrit l'ancien job
  (`cron.unschedule`), protégée par une vérification d'existence (sûre
  que la migration 0006 ait tourné ou non sur cette base).
- `app/api/cron/purge-conversations/route.ts` : protégé par
  `CRON_SECRET` si définie (Vercel l'envoie automatiquement sur les
  appels planifiés) — pas de check si absente, comme les autres variables
  optionnelles du projet (ex. `RESEND_API_KEY`).

Testé : `tsc --noEmit` propre, 133 tests au vert (4 nouveaux pour
`purgeExpiredConversations` — rien à purger, purge Storage puis
suppression dans le bon ordre, échec de requête, échec de suppression
après nettoyage Storage déjà fait).

**À appliquer en prod** : migration `0018` (dans l'ordre après les
précédentes) + variable `CRON_SECRET` sur Vercel (ou laisser vide pour le
pilote, au prix de l'endpoint non protégé).

**À tester en conditions réelles (pas encore fait)** — le code est écrit et
type-checké, les règles de validation et l'outil email sont couverts par des
tests unitaires, mais le parcours complet n'a pas été exécuté : appliquer les
migrations 0014 à 0017, activer l'option, envoyer un fichier depuis le widget
(MonAcompagnateur), le retrouver dans la liste des conversations et le
télécharger, vérifier la pièce jointe de l'email quand le visiteur demande à
être recontacté, et vérifier que la suppression de la conversation retire bien
l'objet de Storage.

**Bug signalé en prod (2026-11-09)** : un visiteur de MonAcompagnateur a
envoyé une capture d'écran puis demandé "tu as reçu mon document ?", le
bot a répondu qu'il ne voyait aucun document, en décrivant à la place le
processus d'upload du formulaire de contact du site (contenu indexé sans
rapport avec le widget). Le fichier était pourtant bien enregistré et
visible dans le dashboard.

**Cause** : même angle mort que celui corrigé pour l'outil email (item
33) : l'instruction de cadrage RAG ("N'utilise aucune connaissance
externe à ces extraits") n'avait pas de dérogation pour le message
"Fichier joint : nom" que `storeVisitorFile` écrit pourtant bien dans
l'historique (la ligne "le contexte du LLM suit le mécanisme de
conversation existant" plus haut était vraie pour le stockage, pas pour
l'instruction donnée au modèle sur comment l'interpréter). Sans
dérogation, le modèle traite la question comme n'importe quelle question
cadrée : il cherche la réponse dans les extraits RAG récupérés plutôt que
dans sa propre conversation, et peut se raccrocher à du contenu indexé
sans rapport.

**Corrigé** : `lib/conversationFiles.ts` exporte `VISITOR_FILE_PROMPT_NOTE`
(même mécanisme que `NOTIFY_OWNER_PROMPT_NOTE`), passé à
`buildSystemPrompt` (nouveau paramètre `filesNote`, `lib/prompts.ts`)
depuis `app/api/public-chat/route.ts` quand `allow_visitor_uploads` est
actif. Explique au modèle que "Fichier joint : nom" dans l'historique est
un fait de la conversation (pas de la connaissance externe interdite), à
confirmer par son nom exact sans jamais prétendre lire son contenu.
Testé : `tsc --noEmit` propre, 183 tests au vert (2 nouveaux pour
`filesNote`), `npm run build` propre. Pas encore revérifié en conditions
réelles sur MonAcompagnateur.

**Effort** : moyen-élevé (nouvelle table + bucket + route publique + UI widget
+ dashboard + pièce jointe email).

---

### 49. Analyse IA du fichier envoyé — noté, pas à faire de suite

**Idée (2026-10-12)** : au-delà du simple enregistrement (item 48), analyser le
fichier du visiteur par IA pour l'interpréter et répondre directement (ex. lire
une facture d'énergie, en extraire la consommation, et répondre en conséquence)
plutôt que de seulement le transmettre au propriétaire.

Pistes, pour mémoire :
- Texte (pdf, docx, csv, xlsx, txt) : `lib/extract.ts` (`extractText`) sait déjà
  extraire le contenu des documents de la base de connaissances ; le texte
  pourrait être injecté dans le contexte de la réponse, **éphémère** (non
  indexé dans la base de connaissances du chatbot — un visiteur anonyme ne doit
  pas pouvoir la polluer).
- Scans et images : bloqué par l'OCR (item 7) ou un modèle avec vision.
- À cadrer avant de s'y engager : coût par message (item 35), RGPD (le contenu
  du fichier serait envoyé à OpenAI — mention à ajouter dans
  `docs/rgpd-conformite.md`), prompt injection via le contenu du fichier,
  limite de taille du contexte.

**Effort** : élevé. Dépend de l'item 48.

---

### 50. Le scan d'URL ne lit qu'une page, pas le site entier — ✅ Fait

**Constat (2026-10-22, en prod)** : en ajoutant `https://www.votreaccompagnateur.fr/`
comme source, seule la page d'accueil est indexée. `extractFromUrl`
(`lib/extract.ts`) récupère la page demandée et n'en suit aucun lien : les
pages `/partenaires`, `/smart-sales`, `/devenir-accompagnateur`, `/contact`,
`/mentions-legales` et `/confidentialite` sont ignorées (le site n'a pas de
`sitemap.xml`, pages trouvées via les liens de l'accueil). Résultat : le
chatbot a très peu d'informations.

**Contournement immédiat** : ajouter chaque page à la main, une URL par
document.

**Fait (2026-10-22)** :
- **UI** (`components/UrlUploader.tsx`) : case "Tout le site" à côté du champ
  URL. Elle liste les pages trouvées, toutes cochées sauf celles déjà
  ajoutées comme documents (badge "déjà ajoutée", pour ne pas créer de
  doublons en re-scannant). Chaque page cochée est envoyée, une à la fois, à
  la route existante `upload-url` : **une page = un document** (réessai et
  suppression page par page, source exacte citée dans les réponses, chaque
  page traitée par sa propre requête, donc pas de risque de dépasser le
  `maxDuration` de Vercel).
- **Découverte** (`discoverSiteUrls`, `lib/extract.ts`, route
  `app/api/documents/discover-urls`) : `sitemap.xml` s'il existe (et jusqu'à 3
  sous-sitemaps d'un index), plus les liens de la page de départ et des pages
  qu'elle lie (2 niveaux, par lots de 5 requêtes). Plafond 30 pages
  (`MAX_SITE_PAGES`). Le téléchargement sécurisé (garde SSRF + revalidation à
  chaque redirection) est maintenant une fonction partagée
  (`fetchPublicUrl`) utilisée par l'extraction d'une page et par la
  découverte : mêmes protections pour chaque page et pour le sitemap.
- **Filtrage** (`lib/siteLinks.ts`, pur, testé) : même site seulement (www et
  domaine nu = même site), pas de mailto/tel/javascript, pas de fichiers
  (PDF, images...) ni d'assets (`/_next/`, `/api/`...). URL normalisées sans
  fragment, sans query string et sans `/` final, pour dédoublonner.

Testé : 10 tests unitaires (`lib/siteLinks.test.ts`), types propres ; la
logique de liens appliquée au vrai site trouve bien ses 7 pages. **Testé de
bout en bout en prod (2026-10-30)**, confirmé par l'utilisateur.

**Limites connues** : profondeur 2 sans sitemap (une page enfouie plus loin
n'est trouvée que via le sitemap) ; les sites dont les liens ne sont générés
qu'en JavaScript côté navigateur ne sont pas parcourables (même limite que
l'extraction actuelle) ; les query strings sont ignorées (deux pages qui ne
diffèrent que par `?id=` sont fusionnées).

**Effort** : moyen.

---

### 51. Messages d'attente contextuels — ✅ Fait

**Besoin (2026-10-22)** : les messages d'attente (item 47) sont génériques ;
l'idée était qu'ils s'adaptent à la conversation.

**Idée écartée** : demander au LLM, dans le même prompt que la réponse, de
générer 3-5 messages d'attente pour la *prochaine* question. Pas de coût
d'appel en plus (quelques tokens de sortie), mais : la prochaine question est
impossible à anticiper (messages souvent à côté si le visiteur change de
sujet), les messages proposés décrivaient des actions que le chatbot ne fait
pas ("Calcul de vos économies", "Consultation de nos partenaires" — trompeur
pour le visiteur), et il aurait fallu les retirer du flux de la réponse
affichée.

**Retenu : les étapes réelles**, contextuelles dès la première question et
toujours exactes, sans appel supplémentaire :
- Les deux routes de chat envoient un événement SSE `status` :
  `{ step: 'searching', topic }` juste après la reformulation de la question
  (`topic` = les mots-clés produits par `rewriteQuery`, déjà calculés pour la
  recherche), puis `{ step: 'writing' }` juste avant la génération. Envoyés
  toujours (le widget décide de les afficher ou non).
- `components/ChatWidget.tsx` (`showLoadingSteps`) : "Je cherche "<sujet>"
  dans nos informations…" (sujet tronqué à 50 caractères, rendu en texte, jamais
  en HTML), puis "Je rédige la réponse…". Avant la première étape, la
  rotation des messages configurés reste affichée.
- **Choix par chatbot** (migration `0019_chatbot_loading_steps.sql`,
  `chatbots.show_loading_steps`, défaut `false` : rien ne change pour les
  chatbots existants) — deux boutons radio "Messages personnalisés" / "Étapes
  réelles" au-dessus de la liste des messages (`LoadingMessagesForm`). Les
  chatbots sans documents n'ont pas d'étape de recherche : rotation, puis
  "Je rédige la réponse…".

Testé : types propres. **Testé en prod (2026-10-30)**, confirmé par
l'utilisateur.

**Effort** : faible-moyen.

---

### 52. Séparer dans le dashboard "chatbot widget site" et "second cerveau" — ✅ Fait

**Idée (2026-10-30)** : jusqu'ici tous les chatbots vivaient dans la même
liste du dashboard (`app/dashboard/chatbots/page.tsx`), qu'ils soient pensés
pour être embarqués sur un site (widget public, embed code) ou pour un usage
interne type "second cerveau" (pas de diffusion publique, juste une base de
connaissances à interroger). Deux usages très différents, mêmes réglages
affichés pour les deux (ex. section "Widget / embed" pertinente pour l'un,
pas pour l'autre).

**Constat en creusant le code avant de s'y mettre** : la logique
RAG/chat/ingestion ne bouge pas (déjà partagée, aucune raison de la
dupliquer). Rien dans le modèle ne distinguait les deux cas : la distinction
Chatbot documentaire / Second cerveau / Support client n'existait que comme
texte marketing sur la landing (Catalogue), jamais persistée en base.

**Implémenté** :
- Migration `0021_chatbot_use_case.sql` : `chatbots.use_case text` (défaut
  `'site_widget'`, rétrocompatible — tous les chatbots existants restent
  dans l'interface "Chatbots"), contrainte `in ('site_widget',
  'second_cerveau')`.
- `app/api/chatbots/route.ts` : accepte `useCase` à la création, retombe sur
  `'site_widget'` si absent/invalide.
- **Pas de sélecteur affiché à l'utilisateur** : `CreateChatbotForm` reçoit
  un prop `useCase` fixé par la page appelante (`site_widget` depuis
  `/dashboard/chatbots` et la vue d'ensemble, `second_cerveau` depuis la
  nouvelle page) — chaque interface crée le bon type sans choix
  supplémentaire à faire à l'utilisateur.
- **Nouvelle page** `app/dashboard/second-cerveau/page.tsx` : même structure
  que la page Chatbots, filtrée sur `use_case = 'second_cerveau'`. Nouvelle
  entrée dans `components/Sidebar.tsx` ("Second cerveau", icône `index`) ;
  "Chatbots" renommé "Chatbots (site)" pour la distinction.
- `app/dashboard/chatbots/[id]/page.tsx` : lit `use_case`, masque la section
  "Widget (accès public, apparence, embed)" (et le toggle upload visiteur)
  pour un second cerveau — pas de notion de widget public pour cet usage.
  Lien "retour" et wording de la section Conversations adaptés selon le
  type.

Testé : `tsc --noEmit` propre, 165 tests au vert (pas de nouveau test — que
du filtrage de requête et de l'affichage conditionnel, rien de nouveau à
tester unitairement).

**Pas encore testé en conditions réelles** : créer un chatbot depuis chaque
interface et vérifier qu'il apparaît au bon endroit, et que la page détail
masque bien la section Widget pour un second cerveau.

**Effort** : faible-moyen (1 colonne + 1 nouvelle page + affichage
conditionnel dans la page détail).

---

### 53. Souscription self-service (Stripe Checkout) depuis l'app — ✅ Fait

**Constat (2026-10-30)**, en testant l'intégration Stripe tout juste
branchée (compte test créé, webhook configuré, premier paiement validé
via un Payment Link partagé à la main, voir item 17) : aucun moyen de
payer **depuis l'app elle-même**. Les boutons "Commencer gratuitement" de
la landing n'amènent qu'à l'inscription ; le seul chemin de paiement
existant demandait de créer un Payment Link dans le Dashboard Stripe et
d'y ajouter `?client_reference_id=<organization_id>` à la main — viable
pour 2-3 clients pilotes facturés un par un, pas crédible si un client
pilote veut souscrire tout seul juste après avoir testé l'outil.

**Implémenté** :
- `lib/stripe.ts` `createCheckoutSession` : crée une vraie session Stripe
  Checkout (`mode: 'subscription'`) avec `client_reference_id` posé
  automatiquement sur l'id de l'organisation connectée — produit
  exactement le même événement `checkout.session.completed` qu'un
  paiement via Payment Link, donc **aucun changement nécessaire côté
  webhook** (`app/api/webhooks/stripe/route.ts`). Réutilise le
  `stripe_customer_id` existant de l'org s'il y en a déjà un (évite un
  doublon de client Stripe), sinon préremplit l'email de l'utilisateur
  connecté.
- Nouvelle route `app/api/billing/checkout/route.ts` : authentifie
  l'utilisateur, résout le prix (`STRIPE_PRICE_SOLO`/`_PME`) depuis le
  plan demandé (`solo`/`pme` seulement — Métier reste sur devis, pas de
  self-service), vérifie l'appartenance à l'org via le `select` RLS
  normal (pas besoin de check manuel), renvoie l'URL de la session
  Stripe à rediriger. `success_url`/`cancel_url` pointent vers
  `/dashboard/settings?checkout=success|cancelled`.
- `components/SubscribeButton.tsx` : bouton client, appelle la route puis
  `window.location.href = url`.
- `components/OrgSettingsForm.tsx` : la section Plan change de nature
  selon l'état de l'org. **Avant** (`!hasStripeSubscription`) : affiche
  le plan actuel (étiquette informative) + deux `SubscribeButton`
  (Solo/PME) + note "Métier sur devis, contactez-nous" — **le sélecteur
  radio libre (plan réglable gratuitement sans payer) a été retiré**, il
  n'existait que comme "étiquette informative" avant Stripe et n'a plus
  de raison d'être maintenant qu'un vrai paiement est possible. **Après**
  (`hasStripeSubscription`) : affichage verrouillé inchangé (item 52's
  travail du jour, pas retouché).
- `lib/plans.ts` : nouveau `PLAN_PRICE_LABELS` (`9€ / mois` / `49€ /
  mois`) pour garder un seul endroit où ces montants d'affichage sont
  écrits — la landing (`app/page.tsx`) reste indépendante en texte libre,
  pas encore branchée sur cette constante.
- `app/dashboard/settings/page.tsx` : bannière de confirmation/annulation
  selon `?checkout=success|cancelled` dans l'URL au retour de Stripe.

**Testé en conditions réelles (2026-10-30, mode test Stripe)** : paiement
Solo via le bouton "Souscrire" depuis `/dashboard/settings`, webhook reçu,
`organizations.plan`/`stripe_customer_id` mis à jour automatiquement,
confirmé par l'utilisateur dans Supabase. `tsc --noEmit` propre, 168
tests au vert (3 nouveaux pour `createCheckoutSession` : réutilisation du
client existant, préremplissage email, aucun des deux champs si rien de
disponible).

**Hors scope pour l'instant** : les CTA de la landing (`app/page.tsx`
`Pricing()`) ne déclenchent pas encore ce flux pour un visiteur connecté
— ils renvoient toujours vers `/dashboard`. À brancher si on veut que la
conversion landing → paiement se fasse en un clic sans repasser par
Paramètres.

**Effort** : moyen.

---

### 54. Mini tuto d'onboarding à la première arrivée sur le dashboard — ✅ Fait

**Besoin (2026-10-30)** : un nouvel utilisateur qui crée son organisation
(`components/CreateOrgForm.tsx`) arrivait sur `/dashboard` sans aucune
explication — juste des états vides génériques ("Aucun chatbot pour
l'instant"). Rien n'expliquait la distinction Chatbots (widget site) /
Assistant interne ajoutée le jour même (item 52), ni le chemin normal
pour démarrer.

**Implémenté** :
- `components/OnboardingTour.tsx` (client) : modale à 4 écrans courts
  (Bienvenue, Deux usages Chatbots/Assistant interne, Comment démarrer,
  Paramètres & facturation), navigation Passer/Précédent/Suivant/Terminer
  + points de progression. Même modèle de modale que
  `CreateChatbotForm.tsx` (overlay + `Card`), aucune nouvelle dépendance
  (pas de lib de "tour" type react-joyride/shepherd).
- **Déclenchement** (`app/dashboard/page.tsx`) : affiché seulement si
  `stats.chatbots === 0` **et** `!user.user_metadata.onboarding_dismissed`
  — combiner les deux évite que les utilisateurs pilotes déjà actifs le
  voient apparaître par surprise au déploiement (pas de backfill
  nécessaire pour le flag).
- **Persistance** : `supabase.auth.updateUser({ data: {
  onboarding_dismissed: true } })` — flag sur le compte utilisateur
  (`user_metadata`), pas de nouvelle table/migration pour un seul
  booléen.
- `components/ReplayOnboardingButton.tsx` + bouton "Revoir la
  présentation" sur `/dashboard/docs` : redéclenche la même modale à la
  demande, indépendamment de la condition "0 chatbot".

Testé : `tsc --noEmit` propre, 168 tests au vert (pas de nouveau test —
composant d'interface pur, même traitement que
`CreateChatbotForm`/`OrgSettingsForm`, non testés unitairement dans ce
projet).

**Testé en conditions réelles (2026-11-02)** : apparition confirmée pour
un compte neuf. Retour utilisateur : **trop limité en l'état** — purement
informatif, ne redirige pas vers les pages concernées pendant la visite
(ex. le bouton "Suivant" ne t'emmène pas créer un chatbot), et n'explique
pas vraiment Paramètres/facturation en détail. Amélioration reportée
explicitement ("on poussera ça plus tard") — à revoir : probablement des
liens d'action réels par écran (ex. "Créer mon premier chatbot" qui
amène sur `/dashboard/chatbots`) plutôt que du texte seul.

**Effort** : faible-moyen.

**Refonte interactive (2026-11-06)** : suite au retour ci-dessus, le tuto
déclenché au premier dashboard (`organizationId` fourni) fait maintenant
réellement les actions au lieu de les décrire, en 6 écrans : Bienvenue,
Deux usages (inchangés, informatifs), puis Créer son chatbot (formulaire
intégré, vrai `POST /api/chatbots`), Ajouter un document (upload réel +
polling de statut, étape facultative), Tester (`ChatWidget` embarqué sur
le chatbot qui vient d'être créé), Code d'intégration (snippet avec le
vrai `chatbotId`, lien vers Paramètres/`/dashboard/plan`). Le replay
(`ReplayOnboardingButton`, sans `organizationId`) garde l'ancienne version
purement informative à 4 écrans : rejouer un tuto de création alors qu'un
chatbot existe déjà n'a pas de sens et buterait sur l'entitlement cap
gratuit/solo (1 chatbot, item 56).

Pas de mention des fonctionnalités réservées à PME (indexation IA...)
dans les étapes interactives elles-mêmes : tout ce que fait le tuto doit
marcher sur le palier Gratuit, pour ne pas transformer le premier succès
de l'utilisateur en mur payant. Une seule mention, en note discrète sur
le dernier écran, pointant vers `/dashboard/plan`.

Pas de `router.refresh()` pendant le tuto (seulement à la fermeture) :
en déclencher un dès la création du chatbot aurait fait repasser
`stats.chatbots` à 1 côté serveur, donc `showOnboarding` à `false`, et
démonté le composant en plein milieu des étapes suivantes.

Vérifié : `tsc --noEmit` propre, 170 tests au vert (toujours pas de test
unitaire pour ce composant, même traitement que le reste des formulaires
du dashboard). Pas encore testé manuellement en conditions réelles.

**Replay aussi interactif (2026-11-06)** : le bouton "Revoir la
présentation" (`/dashboard/docs`) lançait encore l'ancienne version
purement informative à 4 écrans. Remplacé par le même tuto interactif
que le premier déclenchement, avec une différence à l'étape "Créer" :
`app/dashboard/docs/page.tsx` passe la liste des chatbots `site_widget`
déjà existants de l'org (`existingChatbots`), et si elle n'est pas vide,
l'étape propose de continuer la démo avec l'un d'eux (sélecteur + bouton
"Continuer", pas d'appel API) plutôt que d'en créer un nouveau, ce qui
buterait sur l'entitlement cap gratuit/solo (1 chatbot, item 56). Filtré
sur `use_case = 'site_widget'` : l'étape finale montre un code
d'intégration public, qui n'a pas de sens pour un assistant interne. Le
mode "4 écrans informatifs sans organisationId" a été supprimé du
composant, il n'a plus d'appelant.

Vérifié à nouveau : `tsc --noEmit`, 170 tests, et `npm run build` (build
de production complet) tous propres. Pas encore testé manuellement.

---

### 55. Changer de palier une fois abonné (portail Stripe) — ✅ Fait

**Signalé (2026-10-30)**, en testant la souscription self-service
(item 53) : une fois abonné, le sélecteur de plan devient lecture seule
avec la note "contactez le support pour changer de palier" — aucun moyen
réel pour un client de changer de palier, mettre à jour sa carte ou
annuler lui-même. Confirmé explicitement nécessaire : "pour moi un user
qui veut changer de plan doit pouvoir le faire".

**Implémenté** : le **portail client Stripe** (hébergé par Stripe,
aucune UI à construire) plutôt qu'un système de changement de palier
maison :
- `lib/stripe.ts` `createBillingPortalSession` :
  `stripe.billingPortal.sessions.create({ customer, return_url })`.
- `app/api/billing/portal/route.ts` : authentifie, vérifie
  l'appartenance à l'org via le `select` RLS normal (même pattern que
  `app/api/billing/checkout/route.ts`), retourne l'URL du portail.
  `return_url` vers `/dashboard/settings`.
- `components/ManageBillingButton.tsx` : bouton "Gérer mon abonnement",
  redirige vers l'URL retournée.
- `components/OrgSettingsForm.tsx` : affiché dans la section Plan quand
  `hasStripeSubscription`, à la place de l'ancienne note "contactez le
  support".

**Configuration Stripe requise (hors code, à faire une fois par mode
test/live)** : Dashboard → Settings → Billing → Customer portal → activer
"Update subscription" et sélectionner les prix Solo/PME comme
destinations de changement autorisées — sinon le portail n'offre que
annulation/moyen de paiement par défaut, pas le changement de palier
demandé. Voir `docs/deployment.md` §4.

Testé : `tsc --noEmit` propre, 169 tests au vert (1 nouveau test pour
`createBillingPortalSession`).

**Vérifié (2026-11-09)** : la configuration du portail côté Stripe (mode
test) était déjà en place, "Les clients peuvent changer d'offre" activé
avec CorpusAI Solo et CorpusAI PME comme produits autorisés, pas
d'action restante ici. À refaire une fois en mode live le jour du
passage.

**Effort** : faible (portail entièrement hébergé par Stripe).

---

### 56. Revoir les montants/quotas des paliers (Solo/PME) : ✅ Fait (2026-11-05)

**Signalé (2026-11-02)**, en testant le changement de palier réel pour la
première fois : les quotas d'alors (Solo 9€ = 300 msg, PME 49€ = 1 500
msg) semblaient mal calibrés, et le palier PME ne se différenciait de
Solo que par le quota, pas par de vraies fonctionnalités en plus.

**Estimation de coût (2026-11-05)**, avant de trancher les chiffres : un
calcul de coût réel mesuré (item 35, toujours ouvert) demande de
capturer les tokens réels par appel OpenAI, ce qui n'est pas encore
instrumenté. En attendant, estimation par budget de tokens à partir des
constantes du code (`lib/elasticsearch.ts` `CANDIDATE_POOL_SIZE` = 15
chunks candidats pour `rerankChunks`, `lib/openai.ts`
`RERANK_MAX_CHUNKS` = 5 chunks dans le contexte final,
`lib/chunking.ts` `TARGET_TOKENS` = 650 tokens/chunk) et du tarif public
de `gpt-5.6-luna` (0,20 $/1M tokens en entrée, 1,20 $/1M en sortie,
d'après plusieurs agrégateurs tiers suite à la baisse de prix de
2026-07-30, à reconfirmer sur la page de tarification officielle
OpenAI) + `text-embedding-3-small` (0,02 $/1M, confirmé). Un message
type (réécriture de requête + embedding + rerank sur 15 chunks +
réponse finale) consomme environ 14 500 tokens en entrée et 540 en
sortie, soit ~0,003 €/message. Le poste le plus lourd est `rerankChunks`,
qui envoie le contenu intégral des 15 chunks candidats au modèle.

**Décision** : **Solo 9€ = 400 msg/mois**, **PME 49€ = 3 000 msg/mois**
(`lib/plans.ts` `PLAN_LIMITS`). Le ratio quota/prix de PME est
volontairement plus généreux que celui de Solo (pas juste le même
ratio x5 remonté) : comme le coût OpenAI estimé reste sous 2€/mois sur
Solo et sous 9€/mois sur PME (contre 49€ facturés), la rentabilité
n'est pas la contrainte à ces niveaux, donc PME peut se permettre de
paraître la meilleure affaire pour inciter à l'upgrade. Chiffre de coût
encore estimé (pas mesuré sur la facturation réelle OpenAI, item 35
reste ouvert pour ça), pas un calcul définitif.

**"Outils en plus" PME, implémentés réellement** : en vérifiant le code,
aucun des avantages déjà annoncés pour PME (assistants illimités,
formats CSV/Excel, membres d'équipe multiples) n'était appliqué
techniquement, la seule vraie limite de palier enforced restait
l'indexation IA (item 18, `AI_INDEXING_ALLOWED_PLANS`). Plutôt que de
garder un décalage marketing/code, deux nouvelles limites réelles
(`lib/plans.ts` `PLAN_CHATBOT_LIMITS`, `PLAN_MEMBER_LIMITS`) : 1 chatbot
et 1 membre sur free/solo, illimité sur pme/metier, vérifiées à la
création (`app/api/chatbots/route.ts`, `app/api/organizations/[id]/
members/route.ts`), jamais rétroactivement sur un org déjà au-dessus
(pas de suppression surprise si un palier change).

**Effort** : faible (constantes + deux checks d'entitlement à la
création, pas de migration).

---

### 57. Pages légales (mentions légales/CGU/confidentialité) — ✅ Fait (brouillon)

**Fait (2026-11-04)** : trois pages rédigées sur `app/legal/[slug]/page.tsx`
(`/legal/mentions-legales`, `/legal/cgu`, `/legal/confidentialite`), déjà
liées depuis le footer de la landing. Identité éditeur : Alexandre DE
BONNIÈRES, entrepreneur individuel (micro-entreprise), SIRET
820 451 656 00012. Bandeau "pas un avis juridique" affiché sur chaque
page, à faire relire par un professionnel du droit avant une ouverture
commerciale à grande échelle.

**Rappel à traiter une fois le déploiement définitif en place** : mettre
à jour dans ces pages l'URL du service (actuellement
`rag-sass-seven.vercel.app`, en attendant l'achat du nom de domaine,
item 42) et l'email de contact (actuellement `adv.dev.france@gmail.com`,
temporaire, une vraie adresse pro doit le remplacer). Les deux valeurs
sont des constantes en haut du fichier (`APP_URL`, `CONTACT_EMAIL`), un
seul endroit à modifier pour chacune.

---

### 58. Méthode de travail inspirée de Spec Kit + `CLAUDE.md` : ✅ Fait

**Contexte (2026-11-04)** : étude de Spec Kit (speckit.org, toolkit open
source de GitHub pour le "Spec-Driven Development"). Principe : avant de
laisser un agent IA coder, on passe par des étapes écrites
(`/constitution`, `/specify`, `/clarify`, `/plan`, `/tasks`, `/analyze`,
`/implement`), chacune produisant un fichier Markdown qui nourrit la
suivante.

**Ce qui est repris**, sans installer l'outil (jugé trop lourd pour les
petits fix) :
- **Constitution** : création de `CLAUDE.md` à la racine, avec les règles
  non négociables du projet (secrets, git, actions externes, backlog,
  rédaction) et les repères techniques.
- **Clarifier avant de coder** : pour une feature moyenne ou grosse, lister
  les zones floues et poser les questions avant d'écrire du code. Une
  décision business non tranchée est notée "à trancher" ici plutôt que
  devinée (comme pour l'item 56).
- **Analyser la cohérence** : relire spec, plan et tâches ensemble avant
  d'implémenter, pour éviter les oublis et le hors-scope.
- **Cérémonie proportionnée** : un petit fix se code directement. Une
  nouvelle table, une nouvelle route ou un impact pricing/RGPD/sécurité
  passent par la méthode complète. La spec et le plan d'une grosse feature
  peuvent vivre dans la section roadmap de l'item.

**Pas repris** : la CLI `specify` et son arborescence `specs/NNN-feature/`,
qui ferait doublon avec cette roadmap.

**Piste ouverte** : si les grosses features se multiplient, réévaluer
l'adoption de Spec Kit, ou de simples commandes slash maison
(`.claude/commands/`) pour outiller les étapes spec, clarification et plan.

---

## 15. Complétude produit avant commercialisation (2026-11-12)

### Réflexion

**Constat** : avant de prendre le vrai nom de domaine et de commercialiser,
le produit paraît restreint pour le prix demandé (Solo 9 €, PME 49 €). Le
socle est solide (RAG, multi-tenant, facturation, agents email et leads),
mais il manque ce qu'un client attend d'un chatbot payant : savoir ce que
ses visiteurs demandent, adapter le widget à son image, garder sa base à
jour, brancher ses outils. Aucune de ces fonctions n'était dans la
roadmap (vérifié dans le code : pas de retour sur les réponses, pas de
statistiques, pas de message d'accueil, pas de re-scan, pas de clé API ni
de webhook sortant).

**Décision sur l'item 33 (MCP Google Calendar)** : mis en pause, sans
modifier l'item 33 ci-dessus. Raisons : (1) avec un serveur MCP auto-hébergé
l'agenda connecté est celui du propriétaire de la plateforme, pas celui du
client ; pour que ce soit une fonction produit, chaque client devrait
connecter son propre agenda par OAuth Google, ce qui impose la vérification
de l'application par Google ; (2) le lien de rendez-vous partagé aux leads
chauds (`meeting_link`, item 21) couvre l'essentiel du besoin sans demander
l'accès à un agenda. À reprendre si un client le demande ; le pattern
d'outils agentiques est déjà en place et le garde-fou prévu pour un chatbot
public (consulter les créneaux libres et transmettre une demande par email,
sans créer d'événement ni lister l'agenda) est décrit dans la conversation
du 2026-11-12.

**Ordre retenu** (valeur visible par le client d'abord) :
1. Statistiques, questions sans réponse et retour 👍/👎 (item 59) : montre
   au client ce que l'outil lui rapporte et quels documents ajouter.
2. Personnalisation du widget (item 60) : message d'accueil, questions
   suggérées, nom et logo ; la mention "Propulsé par" devient un argument
   de palier.
3. Re-scan automatique des sources web (item 61) : une base construite
   depuis un site se périme dès que le site change.
4. Webhook "nouveau lead" (item 62) : relie l'outil à un CRM, Zapier ou
   Make sans demander d'accès aux outils du client.
5. Analyse IA des fichiers envoyés (item 49, déjà noté plus haut,
   implémenté sous l'item 63) : le bot lit réellement le fichier du visiteur.

**Écartés pour l'instant** : connecteurs Google Drive/Notion (même problème
d'autorisation par client que l'agenda), standard téléphonique (item 25),
agent de veille (item 26), coach de simulation (item 28) : gros chantiers
pour un usage de niche.

**Méthode** : un commit par item. Rien n'est poussé tant que la migration
de l'item n'est pas appliquée en base, car un déploiement qui lit une
colonne absente fait tomber la page ou la route concernée (cas vécu avec la
migration `0019`).

---

### 59. Retour 👍/👎 sur les réponses + statistiques par chatbot : ✅ Fait côté code (migration à appliquer, à tester)

**Besoin** : le client n'a aucun moyen de savoir si son chatbot sert à
quelque chose, ni quels documents lui manquent. C'est la fonction qui
justifie un abonnement dans la durée.

**Ce qui est fait** :
- **Retour sur chaque réponse** : deux boutons (utile / pas utile) sous
  chaque réponse du widget public et du chat du dashboard. Cliquer deux
  fois sur le même bouton retire la note. Les routes de chat reçoivent un
  `PATCH` (même vérification d'accès et de propriété de la conversation que
  les autres routes visiteur, limitation de débit en plus). L'id du message
  de réponse arrive au client dans l'évènement SSE `done`.
- **Signal "question sans réponse"** : `messages.no_context` vaut vrai quand
  un chatbot avec documents n'a remonté aucun extrait pertinent (la
  recherche hybride applique déjà un seuil de score, voir item 1). Un
  chatbot en mode "prompt seul" n'en produit jamais.
- **Panneau "Statistiques"** sur la page du chatbot (30 derniers jours) :
  conversations, questions, part de questions sans réponse, retours,
  graphique des questions par jour, liste des questions sans réponse,
  questions les plus posées, réponses jugées pas utiles. Pour un chatbot
  public, seuls les visiteurs comptent (les tests de l'équipe sont exclus).
  Dans la liste des conversations, une réponse notée est signalée.
- **Calcul à la lecture** : une fonction SQL `chatbot_stats_messages`
  (SECURITY INVOKER, donc soumise à la RLS) renvoie les messages de la
  période ; `lib/chatbotStats.ts` déchiffre les questions et agrège côté
  serveur. Pas de table d'agrégats à maintenir. Plafond de 6 000 messages
  lus (le panneau le signale si la période est plus active).

**Limites assumées** :
- "Les plus posées" regroupe les formulations identiques (casse, accents et
  ponctuation mis à part), pas les questions de sens proche. Un regroupement
  sémantique par embeddings serait une amélioration ultérieure.
- Pas de limitation par palier : tous les plans voient les statistiques. À
  réserver à PME/Métier si on veut en faire un argument de montée en gamme
  (une constante dans `lib/plans.ts` suffirait).
- Le fuseau des jours est celui de Paris.

**À appliquer** : migration `0027_message_feedback_and_stats.sql`. Sans elle,
le chat et l'historique plantent (colonnes `feedback`/`no_context` lues et
écrites), donc l'appliquer avant de déployer.

**Tests** : `lib/chatbotStats.test.ts` (agrégation, appariement
question/réponse, regroupement, jours vides) et `lib/feedback.test.ts`.
**À tester en conditions réelles** : noter une réponse dans le widget et le
retrouver dans la liste des conversations, poser une question hors sujet et la
voir apparaître dans "Questions sans réponse", vérifier que la page du chatbot
reste affichée si les statistiques échouent.

---

### 60. Personnalisation du widget : ✅ Fait côté code (migration à appliquer, à tester)

**Besoin** : seule la couleur se réglait (`data-primary-color`). Un client
veut que le widget ressemble à son site : son logo, le nom de son
assistant, un message d'accueil, des questions pour démarrer. C'est aussi
ce qui rend la démo convaincante.

**Ce qui est fait** :
- **Champs par chatbot** (migration `0028`) : `bot_name` (40 caractères),
  `welcome_message` (400), `suggested_questions` (4 maximum, 100 caractères
  chacune), `logo_path`. Validation côté API dans `lib/widgetAppearance.ts`
  (testée), enregistrement par le `PATCH /api/chatbots/[id]` existant.
- **Logo** : envoyé depuis le dashboard (PNG, JPEG ou WebP, 512 Ko). Le type
  est vérifié sur les premiers octets du fichier, pas sur le type annoncé
  par le navigateur ; le SVG est refusé. Stockage dans un bucket public en
  lecture `chatbot-logos` (le logo s'affiche sur le site du client, sans
  session), écrit uniquement par la route `POST /api/chatbots/[id]/logo`
  avec le client service-role après vérification de l'organisation, sans
  policy d'écriture. Remplacer ou retirer le logo supprime l'ancien objet ;
  supprimer un chatbot ou une organisation supprime aussi les logos.
- **Widget** : en-tête avec logo et nom (affiché seulement s'il y en a un),
  message d'accueil en première bulle (rendu Markdown, liens compris),
  questions suggérées cliquables tant que la conversation est vide, qui
  envoient la question comme si le visiteur l'avait tapée. Le test de chat
  du dashboard affiche la même chose pour que le propriétaire voie le rendu.
- **Mention « Propulsé par Corpus.ai »** : affichée en bas du widget pour
  les plans `free` et `solo`, retirée pour PME et Métier
  (`WIDGET_BRANDING_PLANS` dans `lib/plans.ts`). Argument de montée en
  gamme sans coût d'exploitation. Si le plan de l'organisation est
  introuvable, la mention reste affichée.

**Points d'attention** :
- **Changement visible pour les clients existants** : les widgets des
  organisations en plan gratuit ou Solo affichent désormais la mention. À
  vérifier pour le chatbot pilote (votreaccompagnateur.fr) selon le plan de
  son organisation.
- Le texte marketing des paliers (`PLAN_FEATURES`, landing) ne cite pas
  encore « widget sans mention » ni les statistiques : décision de wording à
  prendre avant de communiquer sur la différence de plan.
- La page `/embed/[chatbotId]` lit ces champs sans passer par le contrôle
  `is_public`/`allowed_origins` (comme pour les messages d'attente) : ce sont
  des textes d'affichage non sensibles, l'accès au chat reste contrôlé.
- Avant l'application de la migration, la page embed retombe sur le widget
  simple (la requête échoue et les valeurs par défaut s'appliquent) mais la
  page du chatbot dans le dashboard et son test de chat ne s'affichent pas :
  appliquer `0028` avant de déployer.

**Tests** : `lib/widgetAppearance.test.ts` (validation des textes et des
questions, détection du type réel du logo, SVG et fichier trop gros refusés).
**À tester en conditions réelles** : envoyer un logo, régler nom, accueil et
questions, vérifier le rendu dans l'iframe sur le site client et dans le test de
chat, cliquer une question suggérée, retirer le logo, vérifier la mention sur un
plan gratuit puis son absence en passant l'organisation en PME.

---

### 61. Re-scan automatique des pages web indexées : ✅ Fait côté code (migration à appliquer, à tester)

**Besoin** : une base construite à partir d'un site (item 18 point 5, item
50) se périme dès que le site change : prix, horaires, offres. Sans mise à
jour, le chatbot répond avec d'anciennes informations et le client doit
supprimer et rajouter ses pages à la main. C'est exactement le cas de
votreaccompagnateur.fr.

**Ce qui est fait** :
- **Réglage par chatbot** (`chatbots.source_refresh` : désactivée par défaut,
  tous les jours, toutes les semaines), sous la liste des documents. Ne
  concerne que les documents ajoutés par adresse (`file_type = 'url'`), pas
  les fichiers envoyés.
- **Cron quotidien** `/api/cron/refresh-sources` (05:00 UTC, `vercel.json`),
  protégé par `CRON_SECRET` et qui refuse tout accès si ce secret est absent
  (il déclenche des lectures réseau et des embeddings payants, comme le cron de
  débit). Il traite au plus 20 pages par passage, les moins récemment vérifiées
  d'abord, avec une garde de temps (240 s) : un gros stock est absorbé sur
  plusieurs jours au lieu d'expirer.
- **Ré-indexation seulement si le contenu change** : chaque indexation réussie
  mémorise l'empreinte SHA-256 du texte extrait (`documents.content_hash`). Une
  page identique ne coûte qu'une lecture, aucun embedding.
- **Sécurité du contenu existant** : la page est d'abord lue et extraite. Si
  cela échoue (site indisponible, bloqué), l'ancien contenu reste en place et
  la date de vérification est simplement mise à jour. Les anciens segments ne
  sont supprimés qu'au moment d'écrire les nouveaux.
- **Bouton « Actualiser »** sur chaque page web de la liste (même logique que
  le cron, à la demande, avec le résultat affiché : mise à jour ou déjà à
  jour), et date de dernière vérification affichée sous le document. Utile
  juste après avoir modifié son site, et pour tester sans attendre le cron.

**Limites assumées** :
- Les documents indexés avant cette fonction n'ont pas d'empreinte : leur
  première actualisation les ré-indexe une fois, même sans changement.
- Une page dont le texte change à chaque lecture (date du jour, compteur,
  publicité) est ré-indexée à chaque passage ; le coût reste de quelques
  embeddings par page.
- Seules les pages déjà ajoutées sont suivies : une nouvelle page apparue sur
  le site n'est pas découverte automatiquement (le scan « tout le site » de
  l'item 50 reste manuel). Piste : relancer la découverte et proposer les
  nouvelles pages.
- Pas de limitation par palier : tous les plans y ont accès.

**À appliquer** : migration `0029_source_refresh.sql`, puis déployer (la nouvelle
entrée de `vercel.json` active le cron). `CRON_SECRET` doit être défini sur
Vercel, comme pour les autres crons.

**Tests** : `lib/sourceRefreshRules.test.ts` (calcul d'échéance quotidien et
hebdomadaire, empreinte stable). **À tester en conditions réelles** : activer
« Tous les jours » sur le chatbot de votreaccompagnateur.fr, cliquer sur
« Actualiser » sur une page (première fois : « Page mise à jour », seconde fois :
« Déjà à jour »), modifier un texte sur le site puis actualiser et poser la
question au chatbot, vérifier dans les logs Vercel le passage du cron.
