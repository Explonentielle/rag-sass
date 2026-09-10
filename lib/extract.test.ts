// Tests pour lib/extract.ts — détection du type de fichier et extraction
// du texte à partir des différents formats supportés (txt, md, csv, xlsx).
//
// .docx et .pdf (mammoth / pdf-parse) ne sont PAS testés ici : il leur
// faudrait de vrais fichiers binaires d'exemple (impossible à écrire "en
// dur" dans le code comme une simple chaîne de texte) — voir la note dans
// docs/roadmap.md item 15 sur ce qui reste à couvrir.

import { describe, it, expect } from 'vitest';
import { detectFileType, extractText, UnsupportedDocumentError } from './extract';

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
