// Tests pour lib/openai.ts — uniquement rerankChunks (roadmap item 4), la
// fonction de reranking post-récupération. rewriteQuery et streamAnswer/
// embedTexts ne sont pas testés ici : ce fichier se concentre sur la
// logique ajoutée (parsing de la sortie structurée, repli en cas d'échec),
// pas sur un audit complet du module.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// On mock le SDK `openai` en entier : `getOpenAiClient()` (dans openai.ts)
// fait `new OpenAI({...})`, donc il faut que `import OpenAI from 'openai'`
// renvoie une fausse classe dont on contrôle `chat.completions.create`.
// `createMock` est un `vi.fn()` qu'on reconfigure dans chaque test avec
// `mockResolvedValueOnce`/`mockRejectedValueOnce` pour simuler la réponse
// (ou l'échec) de l'API à ce moment précis.
const createMock = vi.fn();
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));

// Même raison que dans rateLimit.test.ts : éviter de vrais logs sur disque
// pendant les tests.
vi.mock('@/lib/logger', () => ({ logWarn: vi.fn(), logInfo: vi.fn(), logError: vi.fn() }));

const { rerankChunks } = await import('./openai');

// Fabrique une réponse OpenAI minimale contenant le JSON structuré attendu
// par rerankChunks, à l'emplacement où le vrai SDK le met
// (`choices[0].message.content`, une chaîne — la sortie structurée est du
// JSON sérialisé, pas un objet déjà parsé).
function fakeStructuredResponse(body: unknown) {
  return { choices: [{ message: { content: JSON.stringify(body) } }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe('rerankChunks', () => {
  const chunks = [
    { content: 'Procédure de remboursement sous 14 jours.', document_filename: 'faq.md' },
    { content: 'Horaires du support client.', document_filename: 'faq.md' },
    { content: 'Script de traitement de l’objection prix.', document_filename: 'vente.md' },
  ];

  it('returns an empty array unchanged without calling the API', async () => {
    // Rien à reclasser : ne doit même pas déclencher d'appel LLM (coût
    // évité pour rien).
    const result = await rerankChunks('question', []);
    expect(result).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('reorders chunks according to relevantIndices, best first', async () => {
    // Le modèle juge que le chunk 2 (script de vente) est le plus
    // pertinent pour cette question, suivi du chunk 0 — le chunk 1
    // (horaires) est exclu, hors sujet.
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ relevantIndices: [2, 0] }));

    const result = await rerankChunks('comment gérer une objection sur le prix ?', chunks);

    expect(result).toEqual([chunks[2], chunks[0]]);
  });

  it('returns an empty array when the model finds nothing relevant', async () => {
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ relevantIndices: [] }));

    const result = await rerankChunks('quelle est la météo ?', chunks);

    expect(result).toEqual([]);
  });

  it('ignores out-of-range or duplicate indices instead of crashing', async () => {
    // Défensif : même si le modèle renvoie un index invalide (99, hors
    // limites) ou répété (0 deux fois), on ne doit ni planter ni dupliquer
    // le chunk dans le résultat.
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ relevantIndices: [0, 0, 99, 1] }));

    const result = await rerankChunks('question', chunks);

    expect(result).toEqual([chunks[0], chunks[1]]);
  });

  it('falls back to the original order (capped) when the API call fails', async () => {
    createMock.mockRejectedValueOnce(new Error('timeout'));

    const result = await rerankChunks('question', chunks);

    // Repli : ordre d'origine, tel quel (ici sous le plafond donc rien de
    // coupé) — jamais une chaîne qui bloque tout le pipeline de réponse.
    expect(result).toEqual(chunks);
  });

  it('falls back when the response has no usable relevantIndices field', async () => {
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ somethingElse: true }));

    const result = await rerankChunks('question', chunks);

    expect(result).toEqual(chunks);
  });
});
