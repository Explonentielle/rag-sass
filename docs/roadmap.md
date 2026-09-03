# Roadmap technique : optimisations & évolutions

Backlog des améliorations identifiées mais non implémentées. Pas de date
fixe — sert de mémoire centralisée plutôt que de planning strict.

## Vue d'ensemble

| # | Domaine | Item | Effort | Dépend de |
|---|---|---|---|---|
| 1 | RAG | Seuil de score dynamique (remplace `topK` fixe) | Faible | — |
| 2 | RAG | Reformulation de requête (query rewriting) | Moyen | — |
| 3 | RAG | Agent unique topK + reformulation | Moyen | 1, 2 (fallback si insuffisants) |
| 4 | RAG | Reranking post-récupération | Moyen | — |
| 5 | RAG | Chunking sémantique (par section) | Moyen | — |
| 6 | Ingestion | Traitement asynchrone (queue) | Élevé | — |
| 7 | Ingestion | OCR pour PDF scannés | Élevé | — |
| 8 | Ingestion | Formats CSV / Excel | Moyen | — |
| 9 | Chat | Historique de conversation persistant | Moyen | — |
| 10 | Chat | Rate limiting (surtout `/api/public-chat`) | Faible | — |
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

### 1. Seuil de score dynamique (remplace `topK` fixe)

**Problème** : `hybridSearch()` (`lib/elasticsearch.ts`) retourne toujours
exactement `topK: 5` chunks (codé en dur dans `app/api/chat/route.ts` et
`app/api/public-chat/route.ts`), peu importe la question. Une question large
qui toucherait légitimement 10 documents n'en récupère que 5 ; une question
très ciblée en récupère 5 même si 2 suffiraient.

**Proposition** : remplacer le nombre fixe par un seuil sur le score de
fusion RRF (déjà calculé) : prendre tous les chunks au-dessus d'un seuil
X, avec un plafond (ex. 15) pour éviter un contexte démesuré.

**Effort / compromis** : faible — aucun appel LLM supplémentaire, juste un
changement de logique sur des scores déjà calculés. À faire en premier :
gratuit en latence, capture déjà une bonne partie du bénéfice recherché.

### 2. Reformulation de requête (query rewriting)

**Problème** : la question brute de l'utilisateur est envoyée telle quelle
à la fois à la recherche kNN (sémantique) et BM25 (mots-clés). Une question
mal formulée ou à plusieurs volets ("compare X et Y et explique Z") n'est
pas optimale pour l'un ou l'autre.

**Proposition** : un appel LLM (rapide/léger) qui reformule la question en
une requête optimisée pour le sémantique, une pour les mots-clés, et
éventuellement décompose une question à plusieurs volets en sous-requêtes.

**Effort / compromis** : moyen — ajoute un appel LLM avant la recherche
(latence + coût), mais reste une technique établie avec un gain de
pertinence documenté. Prioritaire sur l'agent topK (item 3) car la valeur
est mieux démontrée dans la littérature RAG.

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

### 5. Chunking sémantique

**Problème** : `lib/chunking.ts` découpe par taille cible en caractères
(découpage par phrases), sans tenir compte de la structure du document.

**Proposition** : découper en respectant titres/sections/paragraphes plutôt
qu'une taille fixe.

**Effort / compromis** : moyen — demande de détecter la structure du
document (variable selon le format), gain surtout sur des documents très
structurés (procédures, documentation).

---

## 2. Pipeline d'ingestion

### 6. Traitement asynchrone (queue)

**Problème** : l'ingestion (extraction → chunk → embeddings → indexation)
tourne de façon synchrone dans la requête d'upload (`lib/ingest.ts`). Un
document volumineux peut faire timeout.

**Proposition** : découpler l'upload de l'indexation via une file d'attente
(queue managée ou worker dédié).

**Effort / compromis** : élevé — vrai changement d'architecture (job queue,
polling ou webhook de statut côté UI).

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

### 10. Rate limiting

**Problème** : aucune limite de débit sur les endpoints de chat, en
particulier `/api/public-chat` qui est public par design (voir
`docs/integration.md`).

**Effort / compromis** : faible à moyen selon la solution (in-memory simple
vs. solution distribuée si plusieurs instances serveur).

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
