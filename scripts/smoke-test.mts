// One-off manual smoke test for the ingestion + retrieval pipeline
// (extraction -> chunking -> OpenAI embeddings -> ES indexing -> hybrid
// search), run outside of Next.js/Supabase since only OPENAI_API_KEY and
// Elasticsearch are configured at this point. Not part of the app; safe to
// delete after use.
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}
process.env.ELASTICSEARCH_URL = 'http://localhost:9201';

const { chunkText } = await import('../lib/chunking');
const { embedTexts } = await import('../lib/openai');
const { ensureChunksIndex, getEsClient, hybridSearch, CHUNKS_INDEX } = await import(
  '../lib/elasticsearch'
);

const sampleDoc = `
Script de vente : objection prix.

Quand un client dit que le prix est trop élevé, ne baisse jamais le prix immédiatement.
Reformule d'abord la valeur perçue : demande-lui ce qui compte le plus pour lui dans sa décision.
Ensuite, compare le coût de l'inaction : combien lui coûte de ne rien faire dans les 6 prochains mois ?
Si l'objection persiste, propose un paiement en plusieurs fois plutôt qu'une remise.

Procédure de remboursement.

Un client peut demander un remboursement dans les 14 jours suivant l'achat.
La demande doit être envoyée par email à support@example.com avec le numéro de commande.
Le remboursement est traité sous 5 jours ouvrés une fois la demande validée.
`;

async function main() {
  console.log('1. Chunking...');
  const chunks = chunkText(sampleDoc);
  console.log(`   -> ${chunks.length} chunks`);
  chunks.forEach((c, i) => console.log(`   chunk ${i} (${c.length} chars): ${c.slice(0, 60)}...`));

  console.log('2. Embedding via OpenAI...');
  const embeddings = await embedTexts(chunks);
  console.log(`   -> ${embeddings.length} embeddings, dim=${embeddings[0]?.length}`);

  console.log('3. Ensuring ES index...');
  await ensureChunksIndex();

  console.log('4. Indexing chunks into ES...');
  const es = getEsClient();
  const orgId = 'smoke-test-org';
  const chatbotId = 'smoke-test-bot';
  const documentId = 'smoke-test-doc';

  await es.deleteByQuery({
    index: CHUNKS_INDEX,
    query: { term: { document_id: documentId } },
    refresh: true,
    ignore_unavailable: true,
  } as any).catch(() => {});

  const operations = chunks.flatMap((content, i) => [
    { index: { _index: CHUNKS_INDEX } },
    {
      content,
      embedding: embeddings[i],
      organization_id: orgId,
      chatbot_id: chatbotId,
      document_id: documentId,
      document_filename: 'script-vente.txt',
      chunk_index: i,
    },
  ]);
  await es.bulk({ operations, refresh: true });
  console.log(`   -> indexed ${chunks.length} chunks`);

  console.log('5. Hybrid search: "le client trouve que le prix est trop cher"...');
  const [queryEmbedding] = await embedTexts(['le client trouve que le prix est trop cher']);
  const results = await hybridSearch({
    organizationId: orgId,
    chatbotId,
    queryText: 'le client trouve que le prix est trop cher',
    queryEmbedding,
    topK: 3,
  });
  results.forEach((r, i) =>
    console.log(`   #${i + 1} (score=${r.score.toFixed(4)}): ${r.content.slice(0, 90)}...`)
  );

  console.log('6. Hybrid search: "comment demander un remboursement"...');
  const [queryEmbedding2] = await embedTexts(['comment demander un remboursement']);
  const results2 = await hybridSearch({
    organizationId: orgId,
    chatbotId,
    queryText: 'comment demander un remboursement',
    queryEmbedding: queryEmbedding2,
    topK: 3,
  });
  results2.forEach((r, i) =>
    console.log(`   #${i + 1} (score=${r.score.toFixed(4)}): ${r.content.slice(0, 90)}...`)
  );

  console.log('7. Cross-tenant isolation check (wrong org_id should return nothing relevant)...');
  const results3 = await hybridSearch({
    organizationId: 'some-other-org',
    chatbotId,
    queryText: 'remboursement',
    queryEmbedding: queryEmbedding2,
    topK: 3,
  });
  console.log(`   -> ${results3.length} results for wrong org_id (expected: 0)`);

  await es.deleteByQuery({
    index: CHUNKS_INDEX,
    query: { term: { document_id: documentId } },
    refresh: true,
  });
  console.log('Cleanup done. Smoke test PASSED.');
}

main().catch((err) => {
  console.error('Smoke test FAILED:', err);
  process.exit(1);
});
