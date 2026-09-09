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
| 8 | Ingestion | Formats CSV / Excel | Moyen | ✅ Fait |
| 9 | Chat | Historique de conversation persistant | Moyen | ✅ Fait (migration à appliquer) |
| 10 | Chat | Rate limiting (surtout `/api/public-chat`) | Faible | ✅ Fait |
| 11 | LLM | Bascule génération vers OpenAI | Faible | ✅ Fait |
| 12 | Compte | Changement d'email | Faible (code) | SMTP externe |
| 13 | Compte | Invitation par email (nouveaux comptes) | Faible (code) | SMTP externe |
| 14 | Infra | Self-host Supabase (VPS) | Élevé | VPS provisionné |
| 15 | Qualité | Tests automatisés | Élevé | — |
| 16 | Qualité | Logs locaux (debug/incident) | Faible | ✅ Fait (voir note) |
| 17 | Qualité | Suivi d'usage/coût par org | Moyen | — |
| 18 | Premium | Indexation assistée par IA (doc bruts + URL) | Élevé | 6 (async), entitlement par plan |
| 19 | Templates | Clarifier dans le front que les templates ne sont pas liés en live aux chatbots | Faible | ✅ Fait |
| 20 | RGPD | Plan d'action : rétention/purge, suppression à la demande, chiffrement, logs | Moyen (plan) | A+B+C+D ✅ faits (migrations 0004-0006 à appliquer) — E/F ouverts |
| 21 | Compte | Suppression d'organisation + gestion des membres (retirer, changer de rôle) | Moyen | — |
| 22 | Sécurité | Restriction de domaine + toggle "chatbot public/privé" pour les embeds | Moyen | ✅ Fait |
| 23 | RAG | Mode "prompt seul" (chatbot sans document obligatoire) | Faible-moyen | ✅ Fait |
| 24 | Intégrations | Branchement sur plateformes tierces (calendrier, email) | Élevé | — |

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

### 23. Mode "prompt seul" (chatbot sans document obligatoire) — ✅ fait

**Constat (2026-09-08)** : chaque template par défaut instruit explicitement
"base-toi STRICTEMENT sur les documents fournis en contexte", et
`buildSystemPrompt` (`lib/prompts.ts`) ajoutait systématiquement "N'utilise
aucune connaissance externe à ces extraits. Si la réponse n'y figure pas,
dis-le clairement." — même sans aucun chunk retrouvé. Résultat : un chatbot
sans document indexé refusait **toute** question, même une FAQ triviale que
le propriétaire aurait pu écrire lui-même dans le prompt (cas typique : un
artisan qui veut un petit chatbot pour son site sans vouloir gérer
d'upload de documents).

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

### 21. Suppression d'organisation + gestion des membres

**Constat (2026-09-08)** : la gestion multi-tenant est unidirectionnelle —
on peut créer une organisation (`CreateOrgForm`/`CreateOrgModal`), la
renommer (`OrgSettingsForm`), inviter un membre existant
(`TeamMembers.tsx` + `POST /api/organizations/[id]/members`), mais rien
côté suppression/retrait :

- **Pas de suppression d'organisation.** Aucune route `DELETE`, aucun bouton.
  Une org créée par erreur, ou un pilote qu'on veut nettoyer, reste en base
  indéfiniment (avec tous ses chatbots/documents/conversations en cascade).
- **Pas de retrait de membre.** `TeamMembers.tsx` affiche la liste avec le
  rôle de chacun, mais aucune action dessus — un membre ajouté par erreur ne
  peut être retiré qu'en SQL direct.
- **Pas de changement de rôle** après coup (promouvoir un `member` en
  `admin`, ou l'inverse) — le rôle est figé à `member` dès l'ajout
  (`POST /api/organizations/[id]/members`, ligne `role: 'member'` en dur).
- **Pas de "quitter l'organisation"** pour un membre qui veut partir de
  lui-même sans passer par un admin.
- **Cas non géré : dernier `owner` qui part/est retiré** — une organisation
  sans propriétaire est un état à empêcher explicitement, pas juste "ça
  arrive et personne ne peut plus rien administrer".

**Proposition (pas encore chiffrée en détail)** :
1. Suppression d'org : réservée au(x) `owner`(s), confirmation forte
   (retaper le nom de l'org, pattern classique "danger zone"), cascade déjà
   correcte en DB (`organization_id` FK `on delete cascade` sur
   chatbots/documents/conversations) — donc surtout un problème de route API
   + UI, pas de schéma.
2. Retrait de membre + changement de rôle : actions sur chaque ligne de
   `TeamMembers.tsx`, nouvelles routes `PATCH`/`DELETE` sur
   `/api/organizations/[id]/members/[userId]`, réservées aux `owner`/`admin`
   (RLS `is_org_admin` déjà disponible, voir `types/database.ts`).
3. Garde-fou dernier owner : bloquer le retrait/départ/rétrogradation du
   dernier `owner` d'une organisation (erreur explicite côté API), et/ou
   exiger un transfert de propriété avant de partir.

**Effort** : moyen — pas de nouveau concept technique (RLS et rôles
existent déjà), mais plusieurs routes + UI + le garde-fou dernier-owner à
bien tester (cas limites : org à un seul membre, retrait de soi-même,
retrait simultané par deux admins).

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

### 19. Clarifier dans le front que les templates ne sont pas liés en live — ✅ fait

**Contexte** : un template (par défaut ou personnalisé) n'est qu'un point de
départ copié dans le champ `system_prompt_template` propre à chaque chatbot
au moment où on l'applique. Modifier un template après coup (page Templates)
ne met **pas** à jour les chatbots qui l'utilisaient déjà — chaque chatbot a
sa propre copie indépendante, pas une référence live. Comportement
volontaire, pas un bug.

**Ce qui a été fait (2026-09-08)** : deux notes discrètes (`text-xs
text-slate-400`, cohérent avec le reste du design), pas de changement de
comportement. `app/dashboard/templates/page.tsx` — sous le titre de la
page : "Modifier un template ici ne change pas les chatbots qui l'utilisent
déjà [...]". `components/SystemPromptEditor.tsx` — sous la rangée de
boutons "Partir d'un template" : "Appliquer un template copie son contenu
ici — modifier le template plus tard ne mettra pas à jour ce chatbot."

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

**B. Suppression à la demande (droit à l'effacement)** — ✅ fait
(2026-09-08).
Deux couches : (1) `ChatWidget.tsx` — bouton "supprimer" (icône poubelle,
au survol) sur chaque entrée du sélecteur de conversations, pour son
propre historique (test chat authentifié ou widget public via
`visitorId`), branché sur le `DELETE` déjà existant dans
`app/api/chat/route.ts`/`app/api/public-chat/route.ts`. (2) Le vrai
besoin RGPD — un membre de l'org retrouve et supprime la conversation
**d'un visiteur** qui n'a plus son `visitorId` : nouvelle route
`app/api/chatbots/[id]/conversations/route.ts` (`GET`/`DELETE`),
nouvelles fonctions `lib/conversations.ts` (`listAllConversationsForChatbot`,
`deleteConversationForChatbot`) qui ne filtrent que par `chatbot_id`, pas
par identité — contrairement au `DELETE` de (1) qui reste scopé
`user_id = caller`. Nouveau composant `components/ConversationsPanel.tsx`
(recherche par titre ou par id visiteur/utilisateur + bouton supprimer),
affiché dans une section "Conversations" sur `app/dashboard/chatbots/[id]/page.tsx`.
Sécurité : aucun filtre d'identité applicatif sur cette route — RLS
(`conversations_delete`, transitif via `chatbots.organization_id`) est le
seul garde-fou, cohérent avec le modèle existant (un coéquipier peut déjà
voir/gérer les conversations de test des autres membres de l'org). La
suppression de compte utilisateur authentifié reste couverte
architecturalement (`user_id references auth.users(id) on delete cascade`).
`tsc --noEmit` et `npm run build` passent ; non testé en conditions
réelles (pas encore de projet Supabase connecté sur cette machine au
moment de l'implémentation — migrations 0004/0005/0006 à vérifier/appliquer
avant validation manuelle).

**C. Chiffrement applicatif des messages** — ✅ fait (2026-09-08).
`lib/crypto.ts` (nouveau) : `encryptText`/`decryptText`, AES-256-GCM,
clé `CONVERSATION_ENCRYPTION_KEY` (32 octets, base64) lue depuis les
variables d'env uniquement — jamais stockée dans Postgres, absence =
erreur explicite au premier appel plutôt qu'un fallback silencieux en
clair. Branché dans `lib/conversations.ts` : `appendTurn` chiffre
`content` (les deux rôles) et `sources` avant insertion ; `loadHistory`,
`listConversations` et `listAllConversationsForChatbot` déchiffrent à la
lecture (cette dernière pour le titre affiché dans le nouvel outil
dashboard de l'item B).

**Compatibilité avec les données existantes** : pas de migration de
données. `sources` est une colonne `jsonb` — un tableau JSON signale une
ligne écrite avant cette fonctionnalité (rendue telle quelle), une chaîne
JSON signale un blob chiffré (déchiffré) ; la distinction est native au
typage jsonb, pas une heuristique. `content` est une colonne `text` sans
cette distinction de type : `decryptText` reconnaît un blob chiffré au
format `base64:base64:base64` (`CIPHERTEXT_PATTERN` dans `lib/crypto.ts`)
et renvoie tel quel tout ce qui ne matche pas ce motif — un message en
clair préexistant ne matchera jamais ce format par hasard. Décision
délibérée plutôt qu'une migration de ré-écriture : le projet est encore
pré-pilote (pas de client réel utilisant l'historique à ce stade).

**Compromis assumés** : recherche full-text SQL sur le contenu impossible
désormais (non utilisée aujourd'hui, coût réel nul) ; gestion de la clé
(rotation, sauvegarde — perdre la clé rend l'historique définitivement
illisible) devient un sujet à part entière, pas traité ici. Roundtrip
chiffrement/déchiffrement et passthrough des lignes legacy validés par un
script ad hoc (`node -e ...`, hors repo) ; `tsc --noEmit` et
`npm run build` passent. Non testé contre une vraie base Supabase (même
blocage que B).

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

**E. Sous-traitants tiers à documenter** — hors code.
Vérifier/documenter la région d'hébergement du projet Supabase (UE vs US),
les conditions de traitement de l'API OpenAI (pas d'entraînement sur les
données API par défaut, mais transfert hors UE à noter), Elasticsearch
restant sous contrôle direct tant qu'il tourne en Docker sur l'infra
propre.

**F. Documentation** — hors code.
Registre de traitement minimal (quoi, pourquoi, combien de temps, qui a
accès), modèle de mention à afficher aux visiteurs du widget public
(fourni par Corpus.ai, affiché par le client), modèle de DPA à faire
signer par chaque client pilote (Corpus.ai = sous-traitant, le client =
responsable de traitement).

**Ordre proposé** : A + D d'abord (rien n'est conforme sans ça, effort
faible chacun) — ✅ fait le 2026-09-08, migration 0006 à appliquer. Puis B,
puis C en renforcement — ✅ les deux faits le 2026-09-08 également (code non
testé contre une vraie base Supabase, voir détails ci-dessus). E/F restent
en parallèle, hors code, avant de signer un premier vrai client pilote
(toujours ouverts).

---

## 9. Sécurité des embeds publics

### 22. Restriction de domaine + toggle "chatbot public/privé" — ✅ fait

**Contexte** : `docs/integration.md` listait deux limitations connues avant
un vrai lancement public — n'importe qui connaissant un `chatbotId` pouvait
l'interroger via `/api/public-chat` depuis n'importe quel site, et il
n'existait aucun moyen de désactiver l'accès anonyme à un chatbot.

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
   est servi depuis notre propre domaine, donc ses appels `fetch()` vers
   `/api/public-chat` ont toujours `Origin` = notre domaine, jamais celui
   du site tiers qui embarque l'iframe — un Origin-check seul ne peut pas
   voir qui a chargé la page en iframe, seulement qui a appelé l'API.
5. UI : nouvelle section "Accès public / embed" sur la page de chaque
   chatbot (`components/EmbedSettingsForm.tsx`) — case à cocher public/privé
   + liste de domaines autorisés (un par ligne, vide = aucune restriction).

**Testé** : `tsc --noEmit` et `npm run build` passent (middleware Edge
runtime compatible, pas d'API Node-only importée). Pas encore validé avec
un vrai embed cross-domain en conditions réelles.

---

## 10. Intégrations tierces

### 24. Branchement sur des plateformes annexes (calendrier, email, etc.)

**Idée (2026-09-08)** : au-delà du RAG documentaire, permettre à un chatbot
d'agir — prendre un rendez-vous (Google Calendar/Cal.com), envoyer un email
de suivi, créer une entrée dans un CRM léger — plutôt que seulement
répondre à partir de documents/prompt. Complémentaire au mode "prompt seul"
(item 23) : un artisan pourrait avoir un chatbot qui répond aux questions
ET propose de réserver un créneau directement dans la conversation.

**Pas chiffré** : gros morceau — implique function calling côté LLM
(OpenAI supporte les tool calls), la gestion d'OAuth par intégration et par
organisation (chaque client connecte son propre compte Google/Outlook), et
une UI de configuration par chatbot ("quelles actions cette instance peut
déclencher"). À dimensionner sérieusement avant de s'y engager — pas une
extension mineure du pipeline actuel.

**Effort** : élevé. Reste une idée backlog, aucun code à ce stade.
