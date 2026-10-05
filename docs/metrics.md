
#### 1. Métriques de pipeline (ingestion)

| Métrique                        | Définition                                    | Pourquoi c'est utile                                                      |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| **Débit d'ingestion**           | Nombre de chunks traités / minute             | Détecte les régressions de perf sur le pipeline                           |
| **Temps total de réindexation** | Durée complète pour indexer tout le catalogue | Sert à estimer le temps de recovery en cas de gros incident               |
| **Taux d'échec de batch**       | % de lots ayant échoué / nécessité un retry   | Fiabilité du pipeline, robustesse face aux limites API                    |
| **Coût d'ingestion**            | € dépensés en tokens embeddés / 1000 produits | Permet de projeter le coût à l'échelle (nouveaux produits, réindexations) |

#### 2. Métriques de qualité du retrieval (le plus important)

| Métrique                         | Définition                                                                                               | Pourquoi c'est utile                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Precision@k**                  | Sur les k premiers résultats retournés, quelle proportion est réellement pertinente                      | Mesure directe si la recherche renvoie les bons produits          |
| **Recall@k**                     | Sur tous les produits pertinents qui existent, quelle proportion apparaît dans les k premiers résultats  | Détecte si des produits pertinents sont "invisibles"              |
| **MRR (Mean Reciprocal Rank)**   | Position moyenne du premier résultat pertinent (1/position, moyenné sur toutes les requêtes)             | Indique si les bons résultats arrivent en haut ou en bas de liste |
| **Taux de faux positifs**        | % de résultats retournés qui ne matchent pas du tout la requête                                          | Détecte le bruit généré par le système                            |
| **Delta vs recherche classique** | Écart de precision/recall entre recherche sémantique et recherche mots-clés, sur le même jeu de requêtes | Argument business direct ("+X% de pertinence")                    |

#### 3. Métriques de performance runtime

|Métrique|Définition|Pourquoi c'est utile|
|---|---|---|
|**Latence de requête (p50/p95)**|Temps entre la requête utilisateur et la réponse|Expérience utilisateur, dimensionnement infra|
|**Coût par requête**|€ par recherche utilisateur (embedding de la requête + éventuel appel LLM)|Projection de coût à l'échelle du trafic réel|

---

### Comment automatiser l'évaluation

#### Étape 1 — Construire un jeu de test (golden dataset)

C'est la base de tout : un ensemble de requêtes avec, pour chacune, la liste des produits qu'on attend en réponse.

```
[
  {
    "query": "canapé convertible pour petit salon",
    "expected_product_ids": [1234, 5678, 9012]
  },
  ...
]
```

Deux façons de le construire :

- **Manuelle** : toi ou un collègue métier définit 30-50 requêtes types + les produits attendus (le plus fiable, mais long).
- **Assistée par LLM** : tu donnes à Claude un échantillon de fiches produits et tu lui demandes de générer des requêtes utilisateur plausibles + de valider quels produits du catalogue matchent réellement chaque requête — exactement l'automatisation que tu voulais faire au départ. Ça devient ton outil de génération du jeu de test.

#### Étape 2 — Script d'évaluation automatique

Pour chaque requête du jeu de test :

1. Lancer la recherche sémantique (ton pipeline actuel)
2. Récupérer les k premiers résultats (ex: k=10)
3. Comparer avec `expected_product_ids`
4. Calculer precision@k, recall@k, MRR pour cette requête
5. Moyenner sur l'ensemble du jeu de test

En pseudo-code :

python

```python
def evaluate(test_set, search_function, k=10):
    precisions, recalls, reciprocal_ranks = [], [], []
    for item in test_set:
        results = search_function(item["query"], top_k=k)
        result_ids = [r.product_id for r in results]
        expected = set(item["expected_product_ids"])
        
        hits = [pid for pid in result_ids if pid in expected]
        precisions.append(len(hits) / k)
        recalls.append(len(hits) / len(expected))
        
        rank = next((i+1 for i, pid in enumerate(result_ids) if pid in expected), None)
        reciprocal_ranks.append(1/rank if rank else 0)
    
    return {
        "precision@k": mean(precisions),
        "recall@k": mean(recalls),
        "mrr": mean(reciprocal_ranks)
    }
```

#### Étape 3 — Comparer recherche sémantique vs recherche classique

Lance le même jeu de test sur ton ancien moteur de recherche (mots-clés) et sur le nouveau (embeddings). Ça te donne le delta chiffré à présenter — c'est l'argument le plus parlant, autant pour ton ticket GitLab que pour ton CV.

#### Étape 4 — Intégrer ça en CI

Une fois le script prêt, tu peux l'ajouter à ton pipeline CI/CD existant : à chaque changement du modèle d'embedding, du chunking, ou du prompt, le job relance l'évaluation et log les métriques (ou échoue si elles chutent en dessous d'un seuil). Ça devient un vrai garde-fou qualité, pas juste un test ponctuel — et c'est exactement le genre de pratique ("évaluation automatisée en CI") qui distingue un POC bricolé d'un vrai projet production-ready aux yeux d'un recruteur.

#### Étape 5 — Suivre dans le temps

Stocke les résultats de chaque run (date, precision@k, recall@k, coût) dans un fichier ou une petite table — ça te permet de tracer une courbe de progression, très utile à montrer en entretien ("voici comment j'ai fait passer la precision de 62% à 84% en ajustant la stratégie de chunking").


### Synthèse — étude de marché
Réponse honnête à ta question du début : non, tu ne réinventes pas quelque chose qui n'existe pas — il y a de la concurrence directe et réelle, notamment deux acteurs très proches de Corpus.ai :

Concurrents directs les plus proches
Heeya	Ailog	Chatbase (référence internationale)
Tarif	Gratuit / 19€ / 99€ / mois	49-299€/mois	19-500$/mois
Hébergement	UE, RGPD natif	France souverain	US (pas RGPD natif)
Widget embed	1 snippet JS	Très personnalisable	1 snippet JS
Onboarding	~10 min	~5 min	30-60 min
Positionnement	PME européennes, support client doc-lourd	E-commerce (Shopify/Presta/Woo)	Généraliste, très mature
Cible	Générique EU	E-commerce FR	Généraliste EN
Constat : Heeya fait quasiment ce que fait Corpus.ai — RAG, citation des sources, widget, RGPD/UE natif, tarification flat — à un prix très proche de ce que tu pratiques probablement. Ailog est plus proche du e-commerce que du généraliste. Aucun des deux ne semble avoir de templates verticaux prêts à l'emploi par métier (vente, immobilier, secrétariat médical...) comme toi — c'est le point de différenciation le plus concret que je vois dans ton roadmap actuel, pas la techno RAG elle-même (hybrid search + reranking, ils font probablement des choses comparables).

Là où Corpus.ai peut se différencier réellement :

Templates métiers prêts à l'emploi (item existant) — Heeya/Ailog sont génériques.
Positionnement "PME françaises non-tech" — Ailog vise l'e-commerce, Heeya est UE généraliste, ni l'un ni l'autre ne cible spécifiquement les métiers de service (immobilier, secrétariat, artisanat).
Vente directe/accompagnement plutôt que self-serve pur — un avantage si tu vends en direct plutôt que par acquisition SEO.
Pas de quoi paniquer, mais pas de "océan bleu" non plus — c'est un marché avec 2-3 acteurs sérieux déjà positionnés proche de toi.

Sources : Heeya — Best RAG Chatbot 2026, Ailog — Plateformes RAG No-Code 2026, Chatbase vs Botpress vs Voiceflow

On passe au reranking quand tu veux — je peux commencer maintenant si tu as encore quelques minutes, sinon ce sera pour la prochaine session.