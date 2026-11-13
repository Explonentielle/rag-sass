# Évaluation de la qualité du RAG

Jeu de données de test pour mesurer la qualité du pipeline RAG (retrieval +
génération), indépendamment de n'importe quel org/chatbot réel.

## Contenu

- `fixtures/nordia-systems/*.md` : 8 documents synthétiques (politique
  RH/IT d'une entreprise fictive, "Nordia Systems"), volontairement
  factuels et sans ambiguïté (chiffres, délais, procédures précises) pour
  pouvoir définir une réponse correcte sans discussion possible.
- `fixtures/nordia-systems/queries.json` : 16 questions, chacune avec :
  - `category` : `direct` (fait simple, un document), `paraphrase`
    (reformulée, teste la recherche sémantique au-delà du mot-clé),
    `multi_doc` (nécessite de combiner deux documents), `unanswerable`
    (sujet absent du corpus, la bonne réponse est de le dire plutôt que
    d'inventer), `unanswerable_distractor` (un document pertinent sera
    probablement retrouvé, mais ne répond pas vraiment à la question
    précise posée : teste que le modèle ne sur-généralise pas).
  - `expected_source_documents` : les documents qui devraient apparaître
    parmi les chunks retrouvés.
  - `expected_answer_contains` : les faits/chiffres qui doivent apparaître
    dans la réponse générée.
  - `notes` : pourquoi cette question est intéressante (piège, reformulation...).

- `rag-eval.mts` : script qui indexe les fixtures dans Elasticsearch (local,
  jamais en prod, voir le commentaire en tête du fichier), exécute les 16
  requêtes à travers le vrai pipeline (reformulation de requête, embedding,
  recherche hybride, reranking, génération de la réponse), puis affiche :
  - le taux de "retrieval hit" (le bon document a-t-il été retrouvé ?) pour
    les catégories `direct`/`paraphrase`/`multi_doc` ;
  - le taux de réponse correcte (les faits attendus sont-ils dans la
    réponse ?) pour ces mêmes catégories ;
  - pour les catégories `unanswerable*`, pas de score automatique fiable
    (juste une heuristique grossière de détection de refus) : à relire à la
    main dans la sortie du script.

## Usage

```bash
npm run rag-eval
```

Nécessite un Elasticsearch local qui tourne (`docker compose up -d`, le
`docker-compose.yml` de dev à la racine) et `OPENAI_API_KEY` dans `.env`.
Coûte de vraies requêtes OpenAI (reformulation + embedding + reranking +
génération par question, ~16 questions) : de l'ordre de quelques centimes
par exécution complète, pas plus.

## Limites connues

- L'heuristique de "refus détecté" pour les catégories `unanswerable*` est
  un simple test de mots-clés (`ne trouve rien`, `n'ai pas cette
  information`...), pas un jugement fiable : une réponse qui refuse
  correctement mais avec une formulation différente sera mal comptée. À
  remplacer par un LLM-juge si ce jeu de données est utilisé plus
  sérieusement (hors scope pour cette première version).
- `expected_answer_contains` est un test de sous-chaîne brut (après mise en
  minuscule), pas une vérification sémantique : une réponse correcte mais
  formulée très différemment du texte source peut être comptée à tort comme
  fausse.
- Un seul domaine (RH/IT d'une entreprise fictive) : ne couvre pas tous les
  cas d'usage réels du produit (ex. un chatbot "support client" ou "vente"
  aurait un profil de questions différent).
