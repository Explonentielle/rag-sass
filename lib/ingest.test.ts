// Tests pour lib/ingest.ts — le pipeline d'ingestion partagé (upload de
// fichier ET URL), en particulier le repli indexation IA -> chunking
// mécanique et les transitions de statut (pending -> processing ->
// indexed|error), jamais testés jusqu'ici (voir docs/roadmap.md item 15).
// Tout ce qui parle réseau (Supabase, Elasticsearch, OpenAI) est mocké.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn() }));

const extractTextMock = vi.fn();
const extractFromUrlMock = vi.fn();
vi.mock('@/lib/extract', async () => {
  const actual = await vi.importActual<typeof import('./extract')>('./extract');
  return {
    UnsupportedDocumentError: actual.UnsupportedDocumentError,
    extractText: (...args: unknown[]) => extractTextMock(...args),
    extractFromUrl: (...args: unknown[]) => extractFromUrlMock(...args),
  };
});

const chunkTextMock = vi.fn();
vi.mock('@/lib/chunking', () => ({ chunkText: (...args: unknown[]) => chunkTextMock(...args) }));

const embedTextsMock = vi.fn();
const structureChunksWithAIMock = vi.fn();
vi.mock('@/lib/openai', () => ({
  embedTexts: (...args: unknown[]) => embedTextsMock(...args),
  structureChunksWithAI: (...args: unknown[]) => structureChunksWithAIMock(...args),
}));

const bulkMock = vi.fn();
const refreshMock = vi.fn();
const ensureChunksIndexMock = vi.fn();
vi.mock('@/lib/elasticsearch', () => ({
  CHUNKS_INDEX: 'documents_chunks',
  ensureChunksIndex: (...args: unknown[]) => ensureChunksIndexMock(...args),
  getEsClient: () => ({ bulk: bulkMock, indices: { refresh: refreshMock } }),
}));

const { processDocument, processUrlDocument } = await import('./ingest');

// Fausse chaîne Supabase minimale : juste de quoi satisfaire
// `.from('documents').update(patch).eq('id', id)` et
// `.storage.from('documents').download(path)`, en gardant une trace de
// chaque update pour vérifier les transitions de statut dans les tests.
function fakeSupabase(downloadResult: { data: unknown; error: unknown } = { data: fakeBlob(), error: null }) {
  const updates: Array<{ patch: Record<string, unknown> }> = [];
  const supabase = {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push({ patch });
          return { data: null, error: null };
        },
      }),
    }),
    storage: { from: () => ({ download: async () => downloadResult }) },
  };
  return { supabase: supabase as any, updates };
}

function fakeBlob() {
  return { arrayBuffer: async () => new TextEncoder().encode('contenu brut').buffer };
}

const baseParams = {
  documentId: 'doc-1',
  chatbotId: 'bot-1',
  organizationId: 'org-1',
  storagePath: 'org-1/bot-1/doc-1-fichier.txt',
  fileType: 'txt' as const,
  filename: 'fichier.txt',
};

beforeEach(() => {
  vi.clearAllMocks();
  embedTextsMock.mockImplementation(async (texts: string[]) => texts.map(() => [0.1, 0.2]));
  ensureChunksIndexMock.mockResolvedValue(undefined);
  bulkMock.mockResolvedValue({});
  refreshMock.mockResolvedValue({});
});

describe('processDocument', () => {
  it('indexes a file with the mechanical chunker when AI indexing is off', async () => {
    extractTextMock.mockResolvedValueOnce('texte extrait');
    chunkTextMock.mockReturnValueOnce(['chunk A', 'chunk B']);
    const { supabase, updates } = fakeSupabase();

    const result = await processDocument(supabase, baseParams);

    expect(result).toEqual({ status: 'indexed', chunkCount: 2 });
    expect(structureChunksWithAIMock).not.toHaveBeenCalled();
    expect(bulkMock).toHaveBeenCalledTimes(1);
    // pending->processing, puis l'update final indexed.
    expect(updates[0].patch).toEqual({ status: 'processing' });
    expect(updates[1].patch).toMatchObject({ status: 'indexed', chunk_count: 2 });
  });

  it('uses AI-structured chunks when use_ai_indexing is on and the call succeeds', async () => {
    extractTextMock.mockResolvedValueOnce('texte extrait');
    structureChunksWithAIMock.mockResolvedValueOnce(['segment IA 1', 'segment IA 2', 'segment IA 3']);
    const { supabase } = fakeSupabase();

    const result = await processDocument(supabase, { ...baseParams, useAiIndexing: true });

    expect(result).toEqual({ status: 'indexed', chunkCount: 3 });
    expect(chunkTextMock).not.toHaveBeenCalled(); // repli mécanique jamais déclenché si l'IA a réussi
  });

  it('falls back to the mechanical chunker when AI indexing fails', async () => {
    extractTextMock.mockResolvedValueOnce('texte extrait');
    structureChunksWithAIMock.mockResolvedValueOnce(null); // lib/openai.ts renvoie null en cas d'échec
    chunkTextMock.mockReturnValueOnce(['chunk mécanique']);
    const { supabase } = fakeSupabase();

    const result = await processDocument(supabase, { ...baseParams, useAiIndexing: true });

    expect(result).toEqual({ status: 'indexed', chunkCount: 1 });
  });

  it('marks the document as error when the storage download fails', async () => {
    const { supabase, updates } = fakeSupabase({ data: null, error: { message: 'not found' } });

    const result = await processDocument(supabase, baseParams);

    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Téléchargement du fichier échoué');
    expect(updates[1].patch).toMatchObject({ status: 'error' });
    expect(bulkMock).not.toHaveBeenCalled(); // jamais indexé si l'extraction n'a jamais eu lieu
  });

  it('marks the document as error when no chunk could be produced', async () => {
    extractTextMock.mockResolvedValueOnce('texte extrait');
    chunkTextMock.mockReturnValueOnce([]); // ex. document vide après extraction
    const { supabase, updates } = fakeSupabase();

    const result = await processDocument(supabase, baseParams);

    expect(result.status).toBe('error');
    expect(updates[1].patch.status).toBe('error');
  });
});

describe('processUrlDocument', () => {
  it('indexes a scraped URL the same way as an uploaded file', async () => {
    extractFromUrlMock.mockResolvedValueOnce('contenu de la page');
    chunkTextMock.mockReturnValueOnce(['chunk page']);
    const { supabase } = fakeSupabase();

    const result = await processUrlDocument(supabase, {
      documentId: 'doc-2',
      chatbotId: 'bot-1',
      organizationId: 'org-1',
      url: 'https://exemple.com/page',
    });

    expect(result).toEqual({ status: 'indexed', chunkCount: 1 });
    expect(extractTextMock).not.toHaveBeenCalled(); // chemin fichier jamais emprunté pour une URL
  });

  it('marks the document as error when the URL cannot be scraped (e.g. SSRF guard)', async () => {
    const { UnsupportedDocumentError } = await import('./extract');
    extractFromUrlMock.mockRejectedValueOnce(
      new UnsupportedDocumentError('Cette URL pointe vers une adresse réseau privée, non autorisée.')
    );
    const { supabase, updates } = fakeSupabase();

    const result = await processUrlDocument(supabase, {
      documentId: 'doc-3',
      chatbotId: 'bot-1',
      organizationId: 'org-1',
      url: 'http://169.254.169.254/',
    });

    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('adresse réseau privée');
    expect(updates[1].patch.status).toBe('error');
  });
});
