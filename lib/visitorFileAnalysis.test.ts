import { describe, it, expect } from 'vitest';
import { analyzeVisitorFile } from './visitorFileAnalysis';
import { MAX_EXTRACTED_CHARS_PER_FILE } from './fileContext';

describe('analyzeVisitorFile', () => {
  it('lit un fichier texte', async () => {
    const result = await analyzeVisitorFile(Buffer.from('Devis n°42\nTotal : 1200 €'), 'devis.txt');
    expect(result).toEqual({ status: 'ok', text: 'Devis n°42\nTotal : 1200 €', truncated: false });
  });

  it('lit un CSV', async () => {
    const result = await analyzeVisitorFile(Buffer.from('nom,prix\nStylo,2\n'), 'prix.csv');
    expect(result.status).toBe('ok');
    expect(result.text).toContain('Stylo');
  });

  it('signale un fichier vide', async () => {
    const result = await analyzeVisitorFile(Buffer.from('   \n  '), 'vide.txt');
    expect(result).toEqual({ status: 'empty', text: null, truncated: false });
  });

  it('tronque un texte trop long et le signale', async () => {
    const result = await analyzeVisitorFile(Buffer.from('a'.repeat(MAX_EXTRACTED_CHARS_PER_FILE + 500)), 'long.txt');
    expect(result.status).toBe('ok');
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_EXTRACTED_CHARS_PER_FILE);
  });

  it('renvoie un échec (sans lever) pour un type inconnu', async () => {
    const result = await analyzeVisitorFile(Buffer.from('x'), 'archive.zip');
    expect(result).toEqual({ status: 'failed', text: null, truncated: false });
  });

  it('renvoie un échec (sans lever) pour un fichier corrompu', async () => {
    const result = await analyzeVisitorFile(Buffer.from('ceci nest pas un docx'), 'faux.docx');
    expect(result.status).toBe('failed');
  });
});
