# Évaluation de la qualité du RAG

Jeux de données de test pour mesurer la qualité du pipeline RAG (retrieval +
génération), indépendamment de n'importe quel org/chatbot réel.

## Trois jeux de données

- **`fixtures/volcanic-cloud/`** (par défaut) : deux types de contenu.
  - 8 documents métier (politique commerciale d'un éditeur SaaS fictif
    "Volcanic Cloud" : tarification et paliers, SLA et crédits,
    remboursement, escalade support, sécurité/conformité, gestion des
    comptes, programme partenaires, onboarding entreprise), denses en
    logique métier conditionnelle (seuils, tranches, exceptions, paliers
    qui se ressemblent) : c'est sur ces documents que portent les 20
    questions.
  - 5 documents "distracteurs" (`wiki-*.md`) : extraits Wikipedia complets
    (cloud computing, SaaS, RGPD, centre de données, sécurité des systèmes
    d'information), sans rapport direct avec les questions, ajoutés
    uniquement pour le volume. Ensemble, le corpus indexe ~100 chunks (vs.
    8 avant), pour tester si le retrieval retrouve toujours le bon
    document précis noyé dans un volume bien plus réaliste, au lieu de
    choisir parmi 8 candidats déjà triés sur le volet.
  - Pièges supplémentaires dans les 20 questions : raisonnement par
    tranche (ex. quel crédit SLA pour telle disponibilité constatée) et
    chiffres proches répétés entre documents (ex. "30 jours" dans deux
    contextes différents).
- **`fixtures/cas-limites/`** : reprend les 8 mêmes documents métier
  Volcanic Cloud, plus 3 documents pièges conçus pour faire échouer le
  pipeline autrement qu'avec du volume :
  - `tarification-archive-2025.md` : une ancienne grille tarifaire
    explicitement marquée archivée/obsolète, avec des chiffres différents
    de la grille actuelle.
  - `faq-support-interne.md` : une FAQ d'équipe non à jour, avec plusieurs
    réponses qui contredisent frontalement la politique officielle.
  - `comparatif-marche.md` : une veille concurrentielle citant des
    chiffres d'entreprises concurrentes fictives, volontairement proches
    des chiffres de Volcanic Cloud.

  15 questions ciblant des défauts qu'aucun des deux autres jeux ne teste :
  contradiction entre documents (le modèle doit privilégier la source
  actuelle/officielle), négation/exclusion ("quels paliers n'ont PAS..."),
  dénombrement (compter des éléments plutôt que citer un fait isolé),
  questions ambiguës (palier non précisé, où une réponse complète devrait
  distinguer les cas plutôt que d'en choisir un au hasard), et confusion
  avec un chiffre concurrent très proche mais différent.
- **`fixtures/nordia-systems/`** : politique RH/IT d'une entreprise
  fictive, documents courts (un seul chunk chacun), faits simples. Jeu
  plus léger, utile pour un premier test rapide. 16 questions.

Les trois jeux suivent le même format :

- `*.md` : les documents synthétiques, volontairement factuels et sans
  ambiguïté (chiffres, délais, procédures précises) pour pouvoir définir
  une réponse correcte sans discussion possible (à l'exception délibérée
  des documents pièges de `cas-limites`, qui se contredisent entre eux).
- `queries.json` : les questions, chacune avec :
  - `category` : libre, chaque jeu peut introduire les siennes (`direct`,
    `paraphrase`, `multi_doc`, `unanswerable`, `unanswerable_distractor`
    dans nordia-systems/volcanic-cloud ; `contradiction`, `negation`,
    `counting`, `ambiguous`, `near_miss_competitor` dans cas-limites). Le
    script ne se base plus sur le nom de la catégorie pour décider quoi
    noter (voir plus bas), une nouvelle catégorie n'a donc rien à changer
    côté script.
  - `expected_source_documents` : les documents qui devraient apparaître
    parmi les chunks retrouvés. Noté automatiquement sauf pour
    `unanswerable`/`unanswerable_distractor` (rien à retrouver, ou
    retrouver le distracteur n'est pas une erreur en soi).
  - `expected_answer_contains` : les faits/chiffres qui doivent apparaître
    dans la réponse générée. Laissé à `[]` quand la bonne réponse est trop
    nuancée pour un test de sous-chaîne fiable (ex. une réponse négative,
    ou qui doit distinguer plusieurs cas) : ces questions-là notent quand
    même leur retrieval, juste pas leur réponse, à relire à la main.
  - `notes` : pourquoi cette question est intéressante (piège, reformulation...).

- `rag-eval.mts` : script qui indexe les fixtures dans l'Elasticsearch
  défini par `ELASTICSEARCH_URL` dans `.env` (local ou prod indifféremment,
  voir le commentaire en tête du fichier : les données de test restent
  isolées sous un `chatbot_id` dédié, jamais un vrai chatbot), exécute les
  requêtes à travers le vrai pipeline (reformulation de requête, embedding,
  recherche hybride, reranking, génération de la réponse), puis affiche :
  - le taux de "retrieval hit" (le bon document a-t-il été retrouvé ?),
    noté pour chaque question sauf `unanswerable`/`unanswerable_distractor` ;
  - le taux de réponse correcte (les faits attendus sont-ils dans la
    réponse ?), noté pour chaque question qui fournit un
    `expected_answer_contains` non vide ;
  - pour tout le reste (sujet absent du corpus, nuances trop fines pour un
    test de sous-chaîne), pas de score automatique fiable (juste une
    heuristique grossière de détection de refus) : à relire à la main
    dans la sortie du script.

## Usage

```bash
npm run rag-eval                   # jeu volcanic-cloud (défaut)
npm run rag-eval -- nordia-systems # jeu nordia-systems
npm run rag-eval -- cas-limites    # jeu cas-limites (contradictions, négation, ambiguïté...)
```

Nécessite `OPENAI_API_KEY` et `ELASTICSEARCH_URL`/`_USERNAME`/`_PASSWORD`
dans `.env`, pointant soit vers un Elasticsearch local (`docker compose up
-d elasticsearch`, le `docker-compose.yml` de dev à la racine), soit vers
la prod : les deux fonctionnent, voir la note de sécurité en tête de
`rag-eval.mts`. Coûte de vraies requêtes OpenAI (embedding des ~100 chunks
à l'indexation, puis reformulation + embedding + reranking + génération
par question) : de l'ordre de quelques dizaines de centimes pour une
exécution complète de volcanic-cloud, l'essentiel du coût venant de la
génération des 20 réponses, pas de l'indexation (embedding très bon
marché même sur un gros volume). Beaucoup moins pour nordia-systems.

## Limites connues

- L'heuristique de "refus détecté" pour les catégories `unanswerable*` est
  un simple test de mots-clés (`ne trouve rien`, `n'ai pas cette
  information`...), pas un jugement fiable : une réponse qui refuse
  correctement mais avec une formulation différente sera mal comptée. À
  remplacer par un LLM-juge si ce jeu de données est utilisé plus
  sérieusement (hors scope pour cette première version).
- `expected_answer_contains` est un test de sous-chaîne brut (insensible à
  la casse et aux espaces depuis la correction du 2026-11-13), pas une
  vérification sémantique : une réponse correcte mais formulée très
  différemment du texte source peut quand même être comptée à tort comme
  fausse (vu en pratique sur nordia-systems : "deux facteurs" attendu,
  modèle ayant répondu "2FA"/"double authentification", tout aussi
  correct ; et sur volcanic-cloud : "15%" attendu, modèle ayant écrit
  "15 %" avec une espace, typographie française correcte, corrigé depuis
  en ignorant les espaces dans la comparaison). Les chiffres décimaux (ex.
  "0,0015€") restent le cas le plus exposé à ce type de faux négatif
  (virgule vs point, arrondi) : volcanic-cloud privilégie des
  vérifications sur des seuils ou des mots entiers plutôt que des
  décimales quand c'est possible.
- Les documents `wiki-*.md` de volcanic-cloud sont des extraits complets de
  Wikipédia en français, licence CC BY-SA : attribution et lien présents en
  tête de chaque fichier. Contenu de test interne uniquement, pas redistribué.
- Deux domaines fictifs seulement (RH/IT interne, commercial SaaS) : ne
  couvre pas tous les cas d'usage réels du produit (ex. un chatbot
  "support client grand public" ou "vente" aurait un profil de questions
  différent).
- `cas-limites` ne teste la détection de contradiction qu'en observant si
  la bonne réponse (le document actuel) est citée : il ne vérifie jamais
  explicitement si le modèle *signale* la contradiction elle-même (ex.
  "attention, un document archivé donne un chiffre différent"), ce que le
  prompt "second cerveau" encourage pourtant à faire. À ajouter si ce
  comportement précis devient important à mesurer.
