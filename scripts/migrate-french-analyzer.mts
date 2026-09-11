// One-time migration (docs/roadmap.md item 39): the live ES index
// `documents_chunks` was created before the French analyzer existed on
// `content`, and is a plain index (no alias) — this script moves it onto
// the new alias scheme defined in lib/elasticsearch.ts:
//   1. create the new physical index `documents_chunks-000001` with the
//      French-analyzer mapping (CHUNKS_MAPPING_PROPERTIES / french_content)
//   2. _reindex all existing docs from `documents_chunks` into it — this
//      re-tokenizes `content` under the new analyzer, but copies
//      `embedding` vectors byte-for-byte (no new OpenAI calls, no cost)
//   3. delete the old plain index
//   4. point the `documents_chunks` alias at the new physical index
// Safe to run once against the local docker-compose ES node. Not part of
// the app; safe to delete after use.
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf-8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}
process.env.ELASTICSEARCH_URL = 'http://localhost:9201';

const {
  getEsClient,
  CHUNKS_INDEX,
  chunksPhysicalIndexName,
  CHUNKS_MAPPING_PROPERTIES,
} = await import('../lib/elasticsearch');

// Mirrors the private CHUNKS_ANALYSIS_SETTINGS in lib/elasticsearch.ts —
// duplicated here since it isn't exported, kept in sync manually since
// this script is a one-time, throwaway migration.
const CHUNKS_ANALYSIS_SETTINGS = {
  analysis: {
    filter: {
      french_elision: {
        type: 'elision' as const,
        articles_case: true,
        articles: ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu'],
      },
      french_stop: { type: 'stop' as const, stopwords: '_french_' as const },
      french_stemmer: { type: 'stemmer' as const, language: 'light_french' },
    },
    analyzer: {
      french_content: {
        type: 'custom' as const,
        tokenizer: 'standard',
        filter: ['french_elision', 'lowercase', 'french_stop', 'french_stemmer'],
      },
    },
  },
};

async function main() {
  const es = getEsClient();
  const oldIndex = CHUNKS_INDEX; // 'documents_chunks', currently a plain index
  const newIndex = chunksPhysicalIndexName(1); // 'documents_chunks-000001'

  console.log(`1. Checking old index "${oldIndex}"...`);
  const oldExists = await es.indices.exists({ index: oldIndex });
  if (!oldExists) {
    console.log('   -> does not exist, nothing to migrate. Exiting.');
    return;
  }
  const aliasAlreadyDone = await es.indices.existsAlias({ name: oldIndex });
  if (aliasAlreadyDone) {
    console.log(`   -> "${oldIndex}" is already an alias. Migration already done. Exiting.`);
    return;
  }
  const countBefore = await es.count({ index: oldIndex });
  console.log(`   -> found plain index with ${countBefore.count} documents`);

  console.log(`2. Creating new index "${newIndex}" with French analyzer...`);
  await es.indices.create({
    index: newIndex,
    settings: CHUNKS_ANALYSIS_SETTINGS,
    mappings: { properties: CHUNKS_MAPPING_PROPERTIES },
  });
  console.log('   -> created');

  console.log(`3. Reindexing "${oldIndex}" -> "${newIndex}"...`);
  const reindexResult = await es.reindex({
    source: { index: oldIndex },
    dest: { index: newIndex },
    refresh: true,
    wait_for_completion: true,
  });
  console.log(`   -> reindexed ${reindexResult.total ?? '?'} documents (${reindexResult.failures?.length ?? 0} failures)`);
  if (reindexResult.failures && reindexResult.failures.length > 0) {
    console.error('   -> failures:', JSON.stringify(reindexResult.failures, null, 2));
    throw new Error('Reindex reported failures, aborting before touching the old index.');
  }

  const countAfter = await es.count({ index: newIndex });
  console.log(`   -> new index has ${countAfter.count} documents`);
  if (countAfter.count !== countBefore.count) {
    throw new Error(
      `Count mismatch: old index had ${countBefore.count}, new index has ${countAfter.count}. Aborting before deleting the old index.`
    );
  }

  console.log(`4. Deleting old plain index "${oldIndex}"...`);
  await es.indices.delete({ index: oldIndex });
  console.log('   -> deleted');

  console.log(`5. Creating alias "${oldIndex}" -> "${newIndex}"...`);
  await es.indices.putAlias({ index: newIndex, name: oldIndex });
  console.log('   -> alias created');

  console.log('Migration done. Verifying mapping...');
  const mapping = await es.indices.getMapping({ index: oldIndex });
  const contentField = Object.values(mapping)[0]?.mappings?.properties?.content;
  console.log('   -> content field mapping:', JSON.stringify(contentField));
  console.log('SUCCESS.');
}

main().catch((err) => {
  console.error('Migration FAILED:', err);
  process.exit(1);
});
