// Tests pour lib/visitorFileRules.ts — les règles d'envoi de fichier par un
// visiteur dans le widget (taille, types acceptés, nom utilisable dans un
// chemin de stockage). Appliquées côté widget ET côté serveur.

import { describe, it, expect } from 'vitest';
import {
  validateVisitorFile,
  sanitizeFilenameForPath,
  getFileExtension,
  MAX_VISITOR_FILE_BYTES,
} from './visitorFileRules';

describe('validateVisitorFile', () => {
  it('accepts an allowed type under the size limit and maps its content type', () => {
    // Le Content-Type stocké vient de l'extension, jamais de ce que le client déclare.
    expect(validateVisitorFile('facture.pdf', 1024)).toEqual({
      ok: true,
      contentType: 'application/pdf',
    });
  });

  it('is case-insensitive on the extension', () => {
    expect(validateVisitorFile('PHOTO.JPG', 1024)).toEqual({ ok: true, contentType: 'image/jpeg' });
  });

  it('rejects a file over the size limit', () => {
    const result = validateVisitorFile('gros.pdf', MAX_VISITOR_FILE_BYTES + 1);
    expect(result.ok).toBe(false);
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateVisitorFile('limite.pdf', MAX_VISITOR_FILE_BYTES).ok).toBe(true);
  });

  it('rejects an empty file', () => {
    expect(validateVisitorFile('vide.pdf', 0).ok).toBe(false);
  });

  it('rejects types that could be executed or rendered by a browser', () => {
    // html/svg/exe : un fichier de ce type pourrait s'exécuter chez le
    // propriétaire qui le télécharge, ou être servi comme page.
    for (const name of ['page.html', 'image.svg', 'virus.exe', 'script.js']) {
      expect(validateVisitorFile(name, 1024).ok).toBe(false);
    }
  });

  it('rejects a file with no extension', () => {
    expect(validateVisitorFile('sansextension', 1024).ok).toBe(false);
  });
});

describe('getFileExtension', () => {
  it('returns the lowercase extension after the last dot', () => {
    expect(getFileExtension('archive.tar.PDF')).toBe('pdf');
  });

  it('returns null without an extension or with a trailing dot', () => {
    expect(getFileExtension('fichier')).toBeNull();
    expect(getFileExtension('fichier.')).toBeNull();
  });
});

describe('sanitizeFilenameForPath', () => {
  it('removes accents and replaces unsafe characters', () => {
    expect(sanitizeFilenameForPath('Facture électricité août.pdf')).toBe('Facture_electricite_aout.pdf');
  });

  it('strips any directory part so a name cannot escape its folder', () => {
    // Un visiteur contrôle le nom du fichier : "../" ne doit pas survivre.
    expect(sanitizeFilenameForPath('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilenameForPath('C:\\Users\\moi\\doc.pdf')).toBe('doc.pdf');
  });

  it('drops leading dots and falls back to a default name', () => {
    expect(sanitizeFilenameForPath('.bashrc')).toBe('bashrc');
    expect(sanitizeFilenameForPath('???')).toBe('_');
    expect(sanitizeFilenameForPath('')).toBe('fichier');
  });

  it('keeps the end of a very long name so the extension survives', () => {
    const result = sanitizeFilenameForPath(`${'a'.repeat(200)}.pdf`);
    expect(result.length).toBe(80);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});
