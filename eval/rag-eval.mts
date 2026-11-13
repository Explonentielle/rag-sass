// Évaluation manuelle de la qualité du pipeline RAG (retrieval + génération),
// sur le jeu de données synthétique eval/fixtures/nordia-systems/ (politique
// RH/IT d'une entreprise fictive). Même esprit que scripts/smoke-test.mts :
// appelle le vrai pipeline (OpenAI + Elasticsearch), pas un mock — mais ici
// le but est de mesurer une qualité (taux de bons documents retrouvés, taux
// de réponses correctes), pas juste de vérifier que rien ne plante.
//
// Ne tourne JAMAIS contre l'Elasticsearch de production (comme smoke-test.mts,
// ELASTICSEARCH_URL est forcé vers l'instance locale ci-dessous), même si
// .env contient l'URL prod — pour ne jamais polluer un index multi-tenant
// réel avec des données de test.
//
// Usage : npm run rag-eval (voir package.json). Coûte de vraies requêtes
// OpenAI (embeddings + génération) — pas de volume : ~16 questions, chacune
// avec reformulation + embedding + reranking + une réponse complète, de
// l'ordre de quelques centimes au total.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}
process.env.ELASTICSEARCH_URL = 'http://localhost:9201';

const { chunkText } = await import('../lib/chunking');
const { embedTexts, embedText, rewriteQuery, rerankChunks, streamAnswer } = await import('../lib/openai');
const { ensureChunksIndex, getEsClient, hybridSearch, CHUNKS_INDEX } = await import('../lib/elasticsearch');
const { buildSystemPrompt, PROMPT_TEMPLATES } = await import('../lib/prompts');

interface QueryFixture {
  id: string;
  category: 'direct' | 'paraphrase' | 'multi_doc' | 'unanswerable' | 'unanswerable_distractor';
  question: string;
  expected_source_documents: string[];
  expected_answer_contains: string[];
  notes: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'nordia-systems');
const ORG_ID = 'eval-org';
const CHATBOT_ID = 'eval-nordia-systems';

const SYSTEM_PROMPT_TEMPLATE = PROMPT_TEMPLATES.find((t) => t.id === 'second-cerveau')!.template;

// Catégories où le document attendu DOIT être présent parmi les chunks
// retrouvés pour compter comme un succès de retrieval — pour les deux
// catégories "unanswerable", il n'y a rien à retrouver (ou, pour le piège à
// distracteur, retrouver le document n'est pas une erreur en soi : c'est la
// génération qui doit rester honnête malgré ça).
const RETRIEVAL_SCORED_CATEGORIES = new Set(['direct', 'paraphrase', 'multi_doc']);

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
  console.log('1. Indexation des documents de test...');
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
  console.log(`   Total : ${files.length} documents, ${totalChunks} chunks.\n`);
}

function containsAll(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.every((n) => lower.includes(n.toLowerCase()));
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

  const retrievalHit = RETRIEVAL_SCORED_CATEGORIES.has(fixture.category)
    ? fixture.expected_source_documents.every((doc) => retrievedDocs.includes(doc))
    : null; // non noté pour les catégories "unanswerable" (voir commentaire plus haut)

  const answerCorrect =
    fixture.category === 'direct' || fixture.category === 'paraphrase' || fixture.category === 'multi_doc'
      ? containsAll(answer, fixture.expected_answer_contains)
      : null; // "unanswerable*" : pas de correspondance exacte attendue, voir declinedLikely

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
    console.log(`   Réponse : ${result.answer.slice(0, 160).replace(/\n/g, ' ')}...\n`);
  }

  const scored = results.filter((r) => r.retrievalHit !== null);
  const retrievalScore = scored.length
    ? scored.filter((r) => r.retrievalHit).length / scored.length
    : 0;
  const answerScore = scored.length
    ? scored.filter((r) => r.answerCorrect).length / scored.length
    : 0;
  const unanswerable = results.filter((r) => r.retrievalHit === null);

  console.log('='.repeat(60));
  console.log('RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(
    `Retrieval (hit sur les documents attendus) : ${(retrievalScore * 100).toFixed(0)}% (${scored.filter((r) => r.retrievalHit).length}/${scored.length})`
  );
  console.log(
    `Réponse correcte (faits attendus présents) : ${(answerScore * 100).toFixed(0)}% (${scored.filter((r) => r.answerCorrect).length}/${scored.length})`
  );
  console.log(
    `Catégories "unanswerable" (${unanswerable.length}) : à relire à la main ci-dessus, l'heuristique de refus n'est qu'indicative.`
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
