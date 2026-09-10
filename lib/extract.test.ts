import { describe, it, expect } from 'vitest';
import { detectFileType, extractText, UnsupportedDocumentError } from './extract';

// .docx and .pdf extraction (mammoth / pdf-parse) need real binary fixture
// files to test meaningfully — not covered here. txt/md/csv/xlsx need no
// fixtures (plain text in, or a workbook built in-memory), so they're fully
// covered below.

describe('detectFileType', () => {
  it.each([
    ['rapport.pdf', 'pdf'],
    ['contrat.DOCX', 'docx'], // case-insensitive
    ['notes.txt', 'txt'],
    ['guide.md', 'md'],
    ['prix.csv', 'csv'],
    ['catalogue.xlsx', 'xlsx'],
    ['ancien.xls', 'xlsx'], // .xls also maps to the 'xlsx' handler
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
    const text = await extractText(Buffer.from('Bonjour le monde', 'utf-8'), 'txt');
    expect(text).toBe('Bonjour le monde');
  });

  it('returns Markdown content unmodified (raw syntax preserved)', async () => {
    const md = '# Titre\n\nContenu **important**.';
    const text = await extractText(Buffer.from(md, 'utf-8'), 'md');
    expect(text).toBe(md);
  });
});

describe('extractText: csv', () => {
  it('converts rows into synthetic Markdown with headers as context', async () => {
    const csv = 'Nom,Prix\n"Chaise",129.90\n"Bureau",349.00\n';
    const text = await extractText(Buffer.from(csv, 'utf-8'), 'csv');

    expect(text).toContain('### Ligne 1');
    expect(text).toContain('- Nom: Chaise');
    expect(text).toContain('- Prix: 129.90');
    expect(text).toContain('### Ligne 2');
    expect(text).toContain('Bureau');
  });

  it('rejects a CSV with only a header row (no data)', async () => {
    await expect(extractText(Buffer.from('Nom,Prix\n', 'utf-8'), 'csv')).rejects.toThrow(
      UnsupportedDocumentError
    );
  });

  it('rejects malformed CSV content', async () => {
    // Unterminated quote — csv-parse throws on this.
    const malformed = 'Nom,Prix\n"Chaise sans guillemet fermant,129.90\n';
    await expect(extractText(Buffer.from(malformed, 'utf-8'), 'csv')).rejects.toThrow(
      UnsupportedDocumentError
    );
  });
});

describe('extractText: xlsx', () => {
  it('converts a single-sheet workbook into synthetic Markdown', async () => {
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
    expect(text).not.toContain('Feuil1'); // single sheet: no sheet label prefix
  });

  it('labels rows with the sheet name when the workbook has multiple sheets', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Nom: 'A' }]), 'Feuille1');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Nom: 'B' }]), 'Feuille2');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const text = await extractText(buffer, 'xlsx');
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
