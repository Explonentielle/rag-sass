import { describe, it, expect } from 'vitest';
import {
  buildFileContextBlock,
  truncateExtractedText,
  hasReadableText,
  type FileContextEntry,
} from './fileContext';

const ok = (filename: string, text: string, truncated = false): FileContextEntry => ({
  filename,
  status: 'ok',
  text,
  truncated,
});

describe('truncateExtractedText', () => {
  it('laisse un texte court intact', () => {
    expect(truncateExtractedText('abc', 10)).toEqual({ text: 'abc', truncated: false });
  });

  it('coupe un texte trop long et le signale', () => {
    expect(truncateExtractedText('abcdef', 3)).toEqual({ text: 'abc', truncated: true });
  });
});

describe('hasReadableText', () => {
  it('exige un statut ok et du texte', () => {
    expect(hasReadableText(ok('a.txt', 'x'))).toBe(true);
    expect(hasReadableText({ filename: 'a', status: 'ok', text: '', truncated: false })).toBe(false);
    expect(hasReadableText({ filename: 'a', status: 'empty', text: null, truncated: false })).toBe(false);
    expect(hasReadableText({ filename: 'a', status: null, text: null, truncated: false })).toBe(false);
  });
});

describe('buildFileContextBlock', () => {
  it("renvoie une chaîne vide s'il n'y a aucun fichier", () => {
    expect(buildFileContextBlock([])).toBe('');
  });

  it('délimite le contenu de chaque fichier', () => {
    const block = buildFileContextBlock([ok('devis.pdf', 'Total : 1200 €')]);
    expect(block).toContain('[Début du fichier « devis.pdf »]');
    expect(block).toContain('Total : 1200 €');
    expect(block).toContain('[Fin du fichier « devis.pdf »]');
  });

  it('signale un fichier illisible au lieu de laisser croire qu\'il a été lu', () => {
    const block = buildFileContextBlock([
      { filename: 'scan.png', status: 'empty', text: null, truncated: false },
      { filename: 'cassé.docx', status: 'failed', text: null, truncated: false },
      { filename: 'attente.pdf', status: null, text: null, truncated: false },
    ]);
    expect(block).toContain('« scan.png » : aucun texte lisible');
    expect(block).toContain('« cassé.docx » : lecture impossible');
    expect(block).toContain('« attente.pdf » : lecture impossible');
    expect(block).not.toContain('[Début du fichier');
  });

  it('signale un contenu tronqué par la limite du fichier', () => {
    const block = buildFileContextBlock([ok('long.txt', 'abc', true)]);
    expect(block).toContain('contenu tronqué');
  });

  it("respecte le budget total et dit quand un fichier n'a plus de place", () => {
    const block = buildFileContextBlock([ok('a.txt', 'a'.repeat(10)), ok('b.txt', 'b'.repeat(10))], 10);
    expect(block).toContain('a'.repeat(10));
    expect(block).not.toContain('bbbbbbbbbb');
    expect(block).toContain('« b.txt » : contenu non inclus faute de place');
  });

  it('coupe un fichier qui dépasse le reste du budget', () => {
    const block = buildFileContextBlock([ok('a.txt', 'a'.repeat(20))], 5);
    expect(block).toContain('aaaaa');
    expect(block).not.toContain('aaaaaa');
    expect(block).toContain('contenu tronqué');
  });

  it("neutralise les guillemets et retours à la ligne d'un nom de fichier", () => {
    const block = buildFileContextBlock([ok('a«b»\nc.txt', 'x')]);
    expect(block).toContain('[Début du fichier « a b  c.txt »]');
  });
});
