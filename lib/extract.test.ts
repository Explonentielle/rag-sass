// Tests pour lib/extract.ts — détection du type de fichier et extraction
// du texte à partir des différents formats supportés (txt, md, csv, xlsx),
// plus extractFromUrl (ingestion par URL, roadmap.md item 18 point 5).
//
// .docx et .pdf (mammoth / pdf-parse) ne sont PAS testés ici : il leur
// faudrait de vrais fichiers binaires d'exemple (impossible à écrire "en
// dur" dans le code comme une simple chaîne de texte) — voir la note dans
// docs/roadmap.md item 15 sur ce qui reste à couvrir.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectFileType, extractText, extractFromUrl, UnsupportedDocumentError } from './extract';

// `dns.lookup` est mocké pour contrôler quelle IP un hostname "résout" à,
// sans dépendre d'une vraie résolution DNS (lente, non déterministe en
// test) — c'est ce que le garde-fou SSRF d'extractFromUrl interroge avant
// tout fetch.
const dnsLookupMock = vi.fn();
vi.mock('node:dns/promises', () => ({ default: { lookup: (...args: unknown[]) => dnsLookupMock(...args) } }));

const fetchMock = vi.fn();

function htmlResponse(html: string, status = 200, contentType = 'text/html; charset=utf-8') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', contentType]]),
    text: async () => html,
  } as unknown as Response;
}

function redirectResponse(location: string, status = 302) {
  return {
    ok: false,
    status,
    headers: new Map([['location', location]]),
    text: async () => '',
  } as unknown as Response;
}

describe('detectFileType', () => {
  // `it.each([...])(...)` : au lieu d'écrire 7 fois un `it('détecte X', ...)`
  // presque identique, on donne une LISTE de cas (ici des paires
  // [nom_de_fichier, extension_attendue]), et Vitest lance automatiquement
  // un test séparé pour chaque ligne du tableau. `%s` dans la description
  // est remplacé par les valeurs de la ligne en cours (utile pour repérer
  // dans le rapport quel cas précis a échoué).
  it.each([
    ['rapport.pdf', 'pdf'],
    ['contrat.DOCX', 'docx'], // insensible à la casse
    ['notes.txt', 'txt'],
    ['guide.md', 'md'],
    ['prix.csv', 'csv'],
    ['catalogue.xlsx', 'xlsx'],
    ['ancien.xls', 'xlsx'], // .xls est aussi redirigé vers le handler 'xlsx'
  ])('detects %s as %s', (filename, expected) => {
    expect(detectFileType(filename)).toBe(expected);
  });

  it('returns null for an unsupported extension', () => {
    expect(detectFileType('image.png')).toBeNull();
  });

  it('returns null for a filename with no extension', () => {
    expect(detectFileType('README')).toBeNull();
  });
});

describe('extractText: txt / md', () => {
  it('returns plain text buffers as-is', async () => {
    // extractText est une fonction `async` (elle lit potentiellement des
    // fichiers volumineux/appelle des librairies asynchrones pour docx/pdf)
    // — il faut donc `await` son résultat, et le test lui-même doit être
    // déclaré `async () => { ... }`.
    const text = await extractText(Buffer.from('Bonjour le monde', 'utf-8'), 'txt');
    expect(text).toBe('Bonjour le monde');
  });

  it('returns Markdown content unmodified (raw syntax preserved)', async () => {
    // Le Markdown est traité comme du texte brut à ce stade (le découpage
    // par titres a lieu plus tard, dans lib/chunking.ts) — la syntaxe #, **
    // etc. doit rester intacte.
    const md = '# Titre\n\nContenu **important**.';
    const text = await extractText(Buffer.from(md, 'utf-8'), 'md');
    expect(text).toBe(md);
  });
});

describe('extractText: csv', () => {
  it('converts rows into synthetic Markdown with headers as context', async () => {
    const csv = 'Nom,Prix\n"Chaise",129.90\n"Bureau",349.00\n';
    const text = await extractText(Buffer.from(csv, 'utf-8'), 'csv');

    // Chaque ligne du CSV doit devenir un petit bloc "### Ligne N" avec ses
    // colonnes en dessous — ce format Markdown de synthèse permet ensuite à
    // lib/chunking.ts de regrouper plusieurs lignes par chunk avec le nom
    // des colonnes comme contexte.
    expect(text).toContain('### Ligne 1');
    expect(text).toContain('- Nom: Chaise');
    expect(text).toContain('- Prix: 129.90');
    expect(text).toContain('### Ligne 2');
    expect(text).toContain('Bureau');
  });

  it('rejects a CSV with only a header row (no data)', async () => {
    // `await expect(promesse).rejects.toThrow(...)` : la variante "async"
    // de `.toThrow` — on vérifie qu'une PROMESSE (pas une fonction
    // synchrone comme dans crypto.test.ts) finit rejetée avec une erreur du
    // bon type, via `UnsupportedDocumentError` (la classe elle-même,
    // exportée par extract.ts).
    await expect(extractText(Buffer.from('Nom,Prix\n', 'utf-8'), 'csv')).rejects.toThrow(
      UnsupportedDocumentError
    );
  });

  it('rejects malformed CSV content', async () => {
    // Guillemet non refermé — la librairie csv-parse lève une erreur
    // dessus, qu'extract.ts doit intercepter et retransformer en
    // UnsupportedDocumentError (message clair pour l'utilisateur) plutôt
    // que de laisser fuiter l'erreur brute de la librairie.
    const malformed = 'Nom,Prix\n"Chaise sans guillemet fermant,129.90\n';
    await expect(extractText(Buffer.from(malformed, 'utf-8'), 'csv')).rejects.toThrow(
      UnsupportedDocumentError
    );
  });
});

describe('extractText: xlsx', () => {
  it('converts a single-sheet workbook into synthetic Markdown', async () => {
    // Pas de vrai fichier .xlsx sur disque nécessaire : la librairie xlsx
    // sait aussi bien LIRE qu'ÉCRIRE des classeurs — on en construit un
    // directement en mémoire avec les données de test, comme le ferait
    // Excel, puis on le passe à extractText comme si un utilisateur
    // venait de l'uploader.
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { Produit: 'Chaise Ergo', Prix: 129.9 },
      { Produit: 'Bureau Pro', Prix: 349 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Feuil1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const text = await extractText(buffer, 'xlsx');
    expect(text).toContain('### Ligne 1');
    expect(text).toContain('Chaise Ergo');
    // Avec une seule feuille, pas besoin de préfixer chaque ligne par le
    // nom de la feuille (ambigu seulement s'il y en a plusieurs).
    expect(text).not.toContain('Feuil1');
  });

  it('labels rows with the sheet name when the workbook has multiple sheets', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Nom: 'A' }]), 'Feuille1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Nom: 'B' }]), 'Feuille2');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const text = await extractText(buffer, 'xlsx');
    // Avec plusieurs feuilles, chaque ligne doit préciser de quelle feuille
    // elle vient, pour ne pas mélanger le contexte.
    expect(text).toContain('### Feuille1 — Ligne 1');
    expect(text).toContain('### Feuille2 — Ligne 1');
  });

  it('rejects a workbook with no data rows', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), 'Vide');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    await expect(extractText(buffer, 'xlsx')).rejects.toThrow(UnsupportedDocumentError);
  });
});

describe('extractFromUrl', () => {
  beforeEach(() => {
    dnsLookupMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an invalid URL before any network call', async () => {
    await expect(extractFromUrl('pas une url')).rejects.toThrow(UnsupportedDocumentError);
    expect(dnsLookupMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-http(s) protocol', async () => {
    await expect(extractFromUrl('file:///etc/passwd')).rejects.toThrow(UnsupportedDocumentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects localhost without attempting a fetch (SSRF guard)', async () => {
    await expect(extractFromUrl('http://localhost:9201/')).rejects.toThrow(UnsupportedDocumentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private IP (SSRF guard)', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '10.0.0.5', family: 4 }]);

    await expect(extractFromUrl('http://interne.exemple.com/')).rejects.toThrow(UnsupportedDocumentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a direct link-local IP literal, e.g. the cloud metadata endpoint', async () => {
    // Cas réel connu de SSRF : 169.254.169.254 sert les credentials cloud
    // (AWS/GCP/Azure) sur la plupart des VPS/instances cloud.
    await expect(extractFromUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      UnsupportedDocumentError
    );
    expect(dnsLookupMock).not.toHaveBeenCalled(); // IP littérale : pas besoin de résolution DNS
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('extracts the main article content from a public page, stripping nav/boilerplate', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    fetchMock.mockResolvedValueOnce(
      htmlResponse(`<html><body>
        <nav>Accueil | Contact | À propos</nav>
        <article><h1>Titre de l'article</h1><p>${'Contenu principal utile et bien assez long pour que Readability le garde comme article. '.repeat(5)}</p></article>
        <footer>© 2026 Exemple — Mentions légales</footer>
      </body></html>`)
    );

    const text = await extractFromUrl('https://exemple.com/article');

    expect(text).toContain('Contenu principal utile');
    expect(text).not.toContain('Mentions légales');
  });

  it('rejects a non-HTML response', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    fetchMock.mockResolvedValueOnce(htmlResponse('{}', 200, 'application/json'));

    await expect(extractFromUrl('https://exemple.com/api')).rejects.toThrow(UnsupportedDocumentError);
  });

  it('rejects an HTTP error response', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    fetchMock.mockResolvedValueOnce(htmlResponse('<html></html>', 404));

    await expect(extractFromUrl('https://exemple.com/missing')).rejects.toThrow(UnsupportedDocumentError);
  });

  it('rejects a page with no extractable main content', async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    fetchMock.mockResolvedValueOnce(htmlResponse('<html><body><nav>Menu</nav></body></html>'));

    await expect(extractFromUrl('https://exemple.com/blank')).rejects.toThrow(UnsupportedDocumentError);
  });

  // docs/roadmap.md item 44, point 2: a redirect must be re-validated by
  // the SSRF guard, exactly like the original URL — these tests prove the
  // fix (before it, redirect: 'follow' would have chased these straight
  // through without ever re-checking the destination).
  describe('redirect re-validation (item 44 point 2)', () => {
    it('rejects a redirect to a private IP instead of following it blindly', async () => {
      dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]); // public — the initial URL passes
      fetchMock.mockResolvedValueOnce(redirectResponse('http://169.254.169.254/latest/meta-data/'));

      await expect(extractFromUrl('https://exemple.com/redirect-to-internal')).rejects.toThrow(
        UnsupportedDocumentError
      );
      // Only the first hop was fetched — the SSRF guard caught the
      // redirect target before a second fetch was ever attempted.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('follows a redirect to another public URL and extracts its content', async () => {
      dnsLookupMock
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]) // original host
        .mockResolvedValueOnce([{ address: '93.184.216.35', family: 4 }]); // redirect target host
      fetchMock
        .mockResolvedValueOnce(redirectResponse('https://exemple2.com/article'))
        .mockResolvedValueOnce(
          htmlResponse(
            `<html><body><article><h1>Titre</h1><p>${'Contenu après redirection légitime, assez long pour Readability. '.repeat(5)}</p></article></body></html>`
          )
        );

      const text = await extractFromUrl('https://exemple.com/old-url');

      expect(text).toContain('Contenu après redirection');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('resolves a relative Location header against the current URL', async () => {
      dnsLookupMock
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
        .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
      fetchMock
        .mockResolvedValueOnce(redirectResponse('/nouvelle-page')) // relative, no host
        .mockResolvedValueOnce(
          htmlResponse(
            `<html><body><article><h1>Titre</h1><p>${'Page cible après redirection relative, contenu assez long. '.repeat(5)}</p></article></body></html>`
          )
        );

      const text = await extractFromUrl('https://exemple.com/ancienne-page');

      expect(text).toContain('Page cible après redirection relative');
      // Resolved against the original host, not left dangling as "/nouvelle-page".
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://exemple.com/nouvelle-page', expect.anything());
    });

    it('rejects a redirect chain longer than the allowed maximum', async () => {
      dnsLookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      // 6 redirects in a row, one more than MAX_REDIRECTS (5) — always
      // pointing somewhere new so it never "succeeds" by accident.
      for (let i = 0; i < 6; i++) {
        fetchMock.mockResolvedValueOnce(redirectResponse(`https://exemple.com/hop-${i}`));
      }

      await expect(extractFromUrl('https://exemple.com/start')).rejects.toThrow(UnsupportedDocumentError);
    });

    it('rejects a redirect with no Location header', async () => {
      dnsLookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Map(),
        text: async () => '',
      } as unknown as Response);

      await expect(extractFromUrl('https://exemple.com/broken-redirect')).rejects.toThrow(
        UnsupportedDocumentError
      );
    });
  });
});
