// Tests pour lib/openai.ts — rerankChunks (roadmap item 4),
// structureChunksWithAI (item 18, indexation assistée par IA), et la
// boucle de function calling de streamAnswer (item 33, agentique).
// rewriteQuery et embedTexts ne sont pas testés ici : ce fichier se
// concentre sur la logique ajoutée (parsing de la sortie structurée, repli
// en cas d'échec), pas sur un audit complet du module.

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

const { rerankChunks, structureChunksWithAI, streamAnswer } = await import('./openai');

// Fabrique un faux stream OpenAI (async itérable de "chunks") — chaque
// entrée de `pieces` devient un chunk avec un `delta.content` et/ou un
// `delta.tool_calls` partiel (le vrai SDK fragmente les tool calls sur
// plusieurs chunks, d'où `index`/`id`/`name`/`args` séparés : streamAnswer
// doit les recoller lui-même).
function fakeStream(
  pieces: Array<{
    content?: string;
    toolCall?: { index: number; id?: string; name?: string; args?: string };
    finishReason?: string | null;
  }>
) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const p of pieces) {
        yield {
          choices: [
            {
              delta: {
                ...(p.content !== undefined ? { content: p.content } : {}),
                ...(p.toolCall
                  ? {
                      tool_calls: [
                        {
                          index: p.toolCall.index,
                          id: p.toolCall.id,
                          function: { name: p.toolCall.name, arguments: p.toolCall.args },
                        },
                      ],
                    }
                  : {}),
              },
              finish_reason: p.finishReason ?? null,
            },
          ],
        };
      }
    },
  };
}

// Draine le générateur et renvoie le texte concaténé + la valeur de retour
// finale ({ truncated }) — évite de répéter la boucle manuelle
// `.next()`/`while (!done)` (nécessaire ici au lieu d'un `for await`, pour
// récupérer la valeur de retour du générateur) dans chaque test.
async function drain(gen: ReturnType<typeof streamAnswer>) {
  let text = '';
  let step = await gen.next();
  while (!step.done) {
    text += step.value;
    step = await gen.next();
  }
  return { text, ...step.value };
}

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

describe('structureChunksWithAI', () => {
  it('returns the cleaned/segmented chunks on a single-batch document', async () => {
    createMock.mockResolvedValueOnce(
      fakeStructuredResponse({ chunks: ['Premier segment.', 'Deuxième segment.'] })
    );

    const result = await structureChunksWithAI('Un texte court tenant dans un seul lot.');

    expect(result).toEqual(['Premier segment.', 'Deuxième segment.']);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('filters out empty/whitespace-only chunks from the model output', async () => {
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ chunks: ['Un vrai segment.', '   ', ''] }));

    const result = await structureChunksWithAI('texte');

    expect(result).toEqual(['Un vrai segment.']);
  });

  it('splits a long document into multiple batches and concatenates the results', async () => {
    // Un texte de 120 000 caractères tient en 3 lots de 50 000 (le dernier
    // partiel) — un appel LLM par lot, résultats concatenés dans l'ordre.
    createMock
      .mockResolvedValueOnce(fakeStructuredResponse({ chunks: ['lot 1'] }))
      .mockResolvedValueOnce(fakeStructuredResponse({ chunks: ['lot 2'] }))
      .mockResolvedValueOnce(fakeStructuredResponse({ chunks: ['lot 3'] }));

    const longText = 'a'.repeat(120_000);
    const result = await structureChunksWithAI(longText);

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual(['lot 1', 'lot 2', 'lot 3']);
  });

  it('returns null (triggering a fallback to the mechanical chunker) if any batch fails', async () => {
    createMock
      .mockResolvedValueOnce(fakeStructuredResponse({ chunks: ['lot 1'] }))
      .mockRejectedValueOnce(new Error('API down'));

    const result = await structureChunksWithAI('a'.repeat(120_000));

    expect(result).toBeNull();
  });

  it('returns null when the model finds nothing usable (e.g. a blank page)', async () => {
    createMock.mockResolvedValueOnce(fakeStructuredResponse({ chunks: [] }));

    const result = await structureChunksWithAI('   \n\n   ');

    expect(result).toBeNull();
  });

  it('returns null on an unparseable/truncated response instead of throwing', async () => {
    createMock.mockResolvedValueOnce({ choices: [{ message: { content: '{"chunks": [' } }] });

    const result = await structureChunksWithAI('texte');

    expect(result).toBeNull();
  });
});

describe('streamAnswer', () => {
  const baseParams = { systemPrompt: 'Tu es un assistant.', history: [], question: 'Bonjour' };

  it('streams plain content when no tool is called (no tools offered)', async () => {
    createMock.mockResolvedValueOnce(
      fakeStream([{ content: 'Bon' }, { content: 'jour !' }, { finishReason: 'stop' }])
    );

    const result = await drain(streamAnswer(baseParams));

    expect(result).toEqual({ text: 'Bonjour !', truncated: false });
    expect(createMock).toHaveBeenCalledTimes(1); // un seul aller-retour, pas de tool
  });

  it('reports truncated: true when the model hits its output ceiling', async () => {
    createMock.mockResolvedValueOnce(fakeStream([{ content: 'Réponse coupée' }, { finishReason: 'length' }]));

    const result = await drain(streamAnswer(baseParams));

    expect(result.truncated).toBe(true);
  });

  it('answers directly without calling the tool when the model has no need for it', async () => {
    const execute = vi.fn();
    createMock.mockResolvedValueOnce(
      fakeStream([{ content: "Je n'ai pas besoin de l'outil." }, { finishReason: 'stop' }])
    );

    const result = await drain(
      streamAnswer({
        ...baseParams,
        tools: [{ name: 'send_follow_up_email', description: '...', parameters: {}, execute }],
      })
    );

    expect(result.text).toBe("Je n'ai pas besoin de l'outil.");
    expect(execute).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  // Régression (2026-10-12) : gpt-5.6-luna refuse les tool calls combinés
  // à son reasoning_effort par défaut sur /v1/chat/completions ("Function
  // tools with reasoning_effort are not supported... set reasoning_effort
  // to 'none'") — observé en direct, pas un cas théorique.
  it('sets reasoning_effort to none when tools are offered, but not otherwise', async () => {
    createMock.mockResolvedValueOnce(fakeStream([{ content: 'ok' }, { finishReason: 'stop' }]));
    await drain(
      streamAnswer({
        ...baseParams,
        tools: [{ name: 'send_follow_up_email', description: '...', parameters: {}, execute: vi.fn() }],
      })
    );
    expect(createMock.mock.calls[0][0].reasoning_effort).toBe('none');

    createMock.mockReset();
    createMock.mockResolvedValueOnce(fakeStream([{ content: 'ok' }, { finishReason: 'stop' }]));
    await drain(streamAnswer(baseParams)); // pas de `tools` cette fois
    expect(createMock.mock.calls[0][0].reasoning_effort).toBeUndefined();
  });

  it('calls the tool, feeds its result back, then streams the real answer (2 rounds)', async () => {
    const execute = vi.fn().mockResolvedValueOnce('Email envoyé avec succès à jean@exemple.com.');

    // Round 0 : le modèle choisit d'appeler l'outil ; les arguments JSON
    // arrivent fragmentés sur 2 chunks (comme le fait le vrai SDK), le nom
    // en un seul morceau, jamais de `content`.
    createMock.mockResolvedValueOnce(
      fakeStream([
        {
          toolCall: {
            index: 0,
            id: 'call_1',
            name: 'send_follow_up_email',
            args: '{"to":"jean@exemple.com",',
          },
        },
        { toolCall: { index: 0, args: '"subject":"Suivi","body":"..."}' } },
        { finishReason: 'tool_calls' },
      ])
    );
    // Round 1 : plus de `tools` côté appel — réponse finale, celle-là streamée au client.
    createMock.mockResolvedValueOnce(
      fakeStream([{ content: "C'est fait, je t'ai envoyé un email." }, { finishReason: 'stop' }])
    );

    const result = await drain(
      streamAnswer({
        ...baseParams,
        tools: [{ name: 'send_follow_up_email', description: '...', parameters: {}, execute }],
      })
    );

    expect(result.text).toBe("C'est fait, je t'ai envoyé un email.");
    expect(execute).toHaveBeenCalledWith({ to: 'jean@exemple.com', subject: 'Suivi', body: '...' });
    expect(createMock).toHaveBeenCalledTimes(2);

    // Round 1 ne doit plus proposer `tools` — sinon un deuxième tool call
    // pourrait repartir en boucle indéfiniment (la boucle est plafonnée à 2
    // rounds par construction, mais autant vérifier l'intention explicitement).
    const secondCallArgs = createMock.mock.calls[1][0];
    expect(secondCallArgs.tools).toBeUndefined();
  });

  it('reports an unknown tool name without crashing', async () => {
    createMock.mockResolvedValueOnce(
      fakeStream([
        { toolCall: { index: 0, id: 'call_1', name: 'outil_fantome', args: '{}' } },
        { finishReason: 'tool_calls' },
      ])
    );
    createMock.mockResolvedValueOnce(fakeStream([{ content: 'Réponse malgré tout.' }, { finishReason: 'stop' }]));

    const result = await drain(
      streamAnswer({ ...baseParams, tools: [{ name: 'autre_outil', description: '...', parameters: {}, execute: vi.fn() }] })
    );

    expect(result.text).toBe('Réponse malgré tout.');
  });
});

describe('createSendFollowUpEmailTool', () => {
  const sendEmailMock = vi.fn();
  vi.doMock('@/lib/email', () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

  it('refuses to send to an invalid-looking email address', async () => {
    const { createSendFollowUpEmailTool } = await import('./agenticTools');
    const tool = createSendFollowUpEmailTool({ chatbotId: 'bot-1' });

    const result = await tool.execute({ to: 'pas-un-email', subject: 'Suivi', body: 'Bonjour' });

    expect(result).toContain('pas une adresse email valide');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('sends the email and reports success for a valid address', async () => {
    sendEmailMock.mockReset().mockResolvedValueOnce(undefined);
    const { createSendFollowUpEmailTool } = await import('./agenticTools');
    const tool = createSendFollowUpEmailTool({ chatbotId: 'bot-1' });

    const result = await tool.execute({ to: 'jean@exemple.com', subject: 'Suivi', body: 'Bonjour' });

    expect(sendEmailMock).toHaveBeenCalledWith({ to: 'jean@exemple.com', subject: 'Suivi', body: 'Bonjour' });
    expect(result).toContain('envoyé avec succès');
  });

  it('reports a clean failure message if sending fails (e.g. RESEND_API_KEY missing)', async () => {
    sendEmailMock.mockReset().mockRejectedValueOnce(new Error('RESEND_API_KEY manquante'));
    const { createSendFollowUpEmailTool } = await import('./agenticTools');
    const tool = createSendFollowUpEmailTool({ chatbotId: 'bot-1' });

    const result = await tool.execute({ to: 'jean@exemple.com', subject: 'Suivi', body: 'Bonjour' });

    expect(result).toContain("Échec de l'envoi");
    expect(result).not.toContain('RESEND_API_KEY'); // pas de détail technique renvoyé au modèle/visiteur
  });
});
