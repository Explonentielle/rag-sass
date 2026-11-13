// Évaluation manuelle de la qualité du pipeline RAG (retrieval + génération),
// sur un jeu de données synthétique sous eval/fixtures/<dataset>/. Même
// esprit que scripts/smoke-test.mts : appelle le vrai pipeline (OpenAI +
// Elasticsearch), pas un mock — mais ici le but est de mesurer une qualité
// (taux de bons documents retrouvés, taux de réponses correctes), pas
// juste de vérifier que rien ne plante.
//
// Deux jeux de données disponibles (voir eval/README.md) :
// - nordia-systems : politique RH/IT d'une entreprise fictive, documents
//   courts (un chunk chacun), faits simples.
// - volcanic-cloud (défaut) : politique commerciale d'un éditeur SaaS
//   fictif (tarification, SLA, remboursement, support, sécurité,
//   partenaires...), documents nettement plus longs et denses en
//   logique métier conditionnelle (seuils, tranches, exceptions), pensé
//   pour un test de charge/précision plus réaliste que nordia-systems.
//
// Utilise l'Elasticsearch défini dans .env (prod ou local selon ce que
// contient le fichier) — sans risque malgré tout : chatbot_id/organization_id
// ci-dessous sont des valeurs factices dédiées à ce script, jamais celles
// d'un vrai chatbot, donc le nettoyage final (deleteByQuery) ne peut
// toucher que ses propres chunks de test, jamais une vraie donnée.
//
// Usage : npm run rag-eval (volcanic-cloud par défaut), ou
// npm run rag-eval -- nordia-systems pour l'autre jeu. Coûte de vraies
// requêtes OpenAI (embeddings + génération), de l'ordre de quelques
// dizaines de centimes pour une exécution complète du jeu volcanic-cloud
// (20 questions, documents plus longs donc plus de chunks à reranker).
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const { chunkText } = await import('../lib/chunking');
const { embedTexts, embedText, rewriteQuery, rerankChunks, streamAnswer } = await import('../lib/openai');
const { ensureChunksIndex, getEsClient, hybridSearch, CHUNKS_INDEX } = await import('../lib/elasticsearch');
const { buildSystemPrompt, PROMPT_TEMPLATES } = await import('../lib/prompts');

interface QueryFixture {
  id: string;
  // Libre (pas un enum figé) : chaque jeu de données peut introduire ses
  // propres catégories (ex. "contradiction", "negation", "counting" dans
  // cas-limites) sans toucher ce script — voir les deux constantes
  // ci-dessous pour ce qui change réellement le comportement de notation.
  category: string;
  question: string;
  expected_source_documents: string[];
  expected_answer_contains: string[];
  notes: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET = process.argv[2] || 'volcanic-cloud';
const FIXTURES_DIR = path.join(__dirname, 'fixtures', DATASET);
const ORG_ID = 'eval-org';
const CHATBOT_ID = `eval-${DATASET}`;

const SYSTEM_PROMPT_TEMPLATE = PROMPT_TEMPLATES.find((t) => t.id === 'second-cerveau')!.template;

// Catégories volontairement exclues de la notation du retrieval (liste
// d'exclusion, pas d'inclusion : toute nouvelle catégorie ajoutée dans un
// jeu de données est notée par défaut, sans toucher ce fichier) : pour
// "unanswerable" il n'y a rien à retrouver, et pour "unanswerable_distractor"
// retrouver le document n'est pas une erreur en soi — c'est la génération
// qui doit rester honnête malgré ça.
const RETRIEVAL_UNSCORED_CATEGORIES = new Set(['unanswerable', 'unanswerable_distractor']);

// Mots-clés simples indiquant que le modèle a bien refusé de répondre plutôt
// que d'inventer — une heuristique grossière, pas un jugement fiable : les
// résultats sur les catégories "unanswerable" sont à relire à la main, pas à
// prendre pour argent comptant.
const DECLINE_SIGNALS = [
  'ne trouve rien',
  "n'ai pas cette information",
  'pas cette information',
  'pas précisé',
  'non précisé',
  'aucune information',
  "ne sais pas",
  "n'est pas mentionné",
  "n'est pas dans",
];

async function indexFixtures(): Promise<void> {
  console.log(`1. Indexation des documents de test (jeu "${DATASET}")...`);
  await ensureChunksIndex();
  const es = getEsClient();

  await es
    .deleteByQuery({
      index: CHUNKS_INDEX,
      query: { term: { chatbot_id: CHATBOT_ID } },
      refresh: true,
      ignore_unavailable: true,
    } as any)
    .catch(() => {});

  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.md'));
  let totalChunks = 0;

  for (const filename of files) {
    const text = readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
    const chunks = chunkText(text);
    const embeddings = await embedTexts(chunks);

    const operations = chunks.flatMap((content, i) => [
      { index: { _index: CHUNKS_INDEX } },
      {
        content,
        embedding: embeddings[i],
        organization_id: ORG_ID,
        chatbot_id: CHATBOT_ID,
        document_id: filename,
        document_filename: filename,
        chunk_index: i,
      },
    ]);
    await es.bulk({ operations, refresh: true });
    totalChunks += chunks.length;
    console.log(`   -> ${filename}: ${chunks.length} chunks`);
  }
  const avgChunks = files.length ? (totalChunks / files.length).toFixed(1) : '0';
  console.log(`   Total : ${files.length} documents, ${totalChunks} chunks (moyenne ${avgChunks}/document).\n`);
}

// Insensible aux espaces en plus de la casse : le modèle écrit "15 %" avec
// une espace avant le symbole (typographie française correcte), alors que
// les fixtures écrivent souvent "15%" sans espace — sans cette tolérance,
// une réponse par ailleurs correcte est comptée à tort comme fausse (vu en
// pratique sur plusieurs questions du jeu volcanic-cloud).
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

function containsAll(haystack: string, needles: string[]): boolean {
  const normalizedHaystack = normalize(haystack);
  return needles.every((n) => normalizedHaystack.includes(normalize(n)));
}

async function runQuery(fixture: QueryFixture) {
  const { semanticQuery, keywordQuery } = await rewriteQuery(fixture.question);
  const queryEmbedding = await embedText(semanticQuery);

  const retrieved = await hybridSearch({
    organizationId: ORG_ID,
    chatbotId: CHATBOT_ID,
    queryText: keywordQuery,
    queryEmbedding,
  });
  const reranked = await rerankChunks(fixture.question, retrieved);
  const retrievedDocs = Array.from(new Set(reranked.map((c) => c.document_filename)));

  const systemPrompt = buildSystemPrompt({
    systemPromptTemplate: SYSTEM_PROMPT_TEMPLATE,
    contextChunks: reranked,
    useDocuments: true,
  });

  let answer = '';
  const gen = streamAnswer({ systemPrompt, history: [], question: fixture.question });
  let step = await gen.next();
  while (!step.done) {
    answer += step.value;
    step = await gen.next();
  }

  const retrievalHit = RETRIEVAL_UNSCORED_CATEGORIES.has(fixture.category)
    ? null // voir le commentaire sur RETRIEVAL_UNSCORED_CATEGORIES ci-dessus
    : fixture.expected_source_documents.every((doc) => retrievedDocs.includes(doc));

  // Notée dès qu'un fixture fournit des faits attendus, pas selon sa
  // catégorie : certains cas (ex. nuance à vérifier à la main sur une
  // question ambiguë) laissent `expected_answer_contains` vide exprès pour
  // ne pas être noté automatiquement, même si leur retrieval l'est.
  const answerCorrect =
    fixture.expected_answer_contains.length > 0 ? containsAll(answer, fixture.expected_answer_contains) : null;

  const declinedLikely = DECLINE_SIGNALS.some((signal) => answer.toLowerCase().includes(signal));

  return { retrievedDocs, answer, retrievalHit, answerCorrect, declinedLikely };
}

async function main() {
  await indexFixtures();

  const queries: QueryFixture[] = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, 'queries.json'), 'utf-8')
  );

  console.log(`2. Exécution de ${queries.length} requêtes...\n`);
  const results: Array<QueryFixture & Awaited<ReturnType<typeof runQuery>>> = [];

  for (const fixture of queries) {
    const result = await runQuery(fixture);
    results.push({ ...fixture, ...result });

    const retrievalLabel =
      result.retrievalHit === null ? 'n/a' : result.retrievalHit ? 'OK' : 'RATÉ';
    const answerLabel =
      result.answerCorrect === null
        ? result.declinedLikely
          ? 'a priori refusé (à relire)'
          : 'N\'A PAS REFUSÉ (à relire)'
        : result.answerCorrect
          ? 'OK'
          : 'RATÉ';

    console.log(`[${fixture.id}] ${fixture.category} : ${fixture.question}`);
    console.log(`   Documents attendus : ${fixture.expected_source_documents.join(', ') || '(aucun)'}`);
    console.log(`   Documents retrouvés : ${result.retrievedDocs.join(', ') || '(aucun)'}`);
    console.log(`   Retrieval : ${retrievalLabel} | Réponse : ${answerLabel}`);
    console.log(`   Réponse : ${result.answer.slice(0, 220).replace(/\n/g, ' ')}...\n`);
  }

  // Retrieval et réponse sont notés indépendamment l'un de l'autre depuis
  // le passage à expected_answer_contains comme critère (voir runQuery) :
  // un fixture peut noter son retrieval sans noter sa réponse (nuance à
  // relire à la main), ou l'inverse.
  const retrievalScored = results.filter((r) => r.retrievalHit !== null);
  const answerScored = results.filter((r) => r.answerCorrect !== null);
  const manualReview = results.filter((r) => r.retrievalHit === null || r.answerCorrect === null);

  console.log('='.repeat(60));
  console.log('RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(
    `Retrieval (hit sur les documents attendus) : ${retrievalScored.length ? ((retrievalScored.filter((r) => r.retrievalHit).length / retrievalScored.length) * 100).toFixed(0) : 0}% (${retrievalScored.filter((r) => r.retrievalHit).length}/${retrievalScored.length})`
  );
  console.log(
    `Réponse correcte (faits attendus présents) : ${answerScored.length ? ((answerScored.filter((r) => r.answerCorrect).length / answerScored.length) * 100).toFixed(0) : 0}% (${answerScored.filter((r) => r.answerCorrect).length}/${answerScored.length})`
  );
  console.log(
    `Cas non notés automatiquement (${manualReview.length}) : à relire à la main ci-dessus (questions sans réponse attendue dans le corpus, nuances, ou l'heuristique de refus, qui n'est qu'indicative).`
  );

  console.log('\n3. Nettoyage des chunks de test...');
  const es = getEsClient();
  await es.deleteByQuery({
    index: CHUNKS_INDEX,
    query: { term: { chatbot_id: CHATBOT_ID } },
    refresh: true,
  });
  console.log('Terminé.');
}

main().catch((err) => {
  console.error('Évaluation RAG échouée :', err);
  process.exit(1);
});
