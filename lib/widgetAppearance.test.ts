import { describe, it, expect } from 'vitest';
import {
  parseOptionalText,
  parseSuggestedQuestions,
  detectLogoExtension,
  validateLogoBytes,
  MAX_LOGO_BYTES,
} from './widgetAppearance';

describe('parseOptionalText', () => {
  it('efface avec null ou une chaîne vide', () => {
    expect(parseOptionalText(null, 'Nom', 10)).toEqual({ ok: true, value: null });
    expect(parseOptionalText('   ', 'Nom', 10)).toEqual({ ok: true, value: null });
  });

  it('rogne le texte', () => {
    expect(parseOptionalText('  Léa  ', 'Nom', 10)).toEqual({ ok: true, value: 'Léa' });
  });

  it('rejette un texte trop long ou du mauvais type', () => {
    expect(parseOptionalText('x'.repeat(11), 'Nom', 10).ok).toBe(false);
    expect(parseOptionalText(42, 'Nom', 10).ok).toBe(false);
  });
});

describe('parseSuggestedQuestions', () => {
  it('efface avec null ou une liste vide', () => {
    expect(parseSuggestedQuestions(null)).toEqual({ ok: true, value: null });
    expect(parseSuggestedQuestions(['', '  '])).toEqual({ ok: true, value: null });
  });

  it('rogne, retire les vides et les doublons', () => {
    expect(parseSuggestedQuestions([' Tarifs ? ', 'Tarifs ?', '', 'Horaires ?'])).toEqual({
      ok: true,
      value: ['Tarifs ?', 'Horaires ?'],
    });
  });

  it('rejette plus de 4 questions ou une question trop longue', () => {
    expect(parseSuggestedQuestions(['a', 'b', 'c', 'd', 'e']).ok).toBe(false);
    expect(parseSuggestedQuestions(['x'.repeat(101)]).ok).toBe(false);
  });

  it('rejette un type invalide', () => {
    expect(parseSuggestedQuestions('Tarifs ?').ok).toBe(false);
    expect(parseSuggestedQuestions([1, 2]).ok).toBe(false);
  });
});

describe('logo', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  it('reconnaît PNG, JPEG et WebP par leurs octets', () => {
    expect(detectLogoExtension(png)).toBe('png');
    expect(detectLogoExtension(jpg)).toBe('jpg');
    expect(detectLogoExtension(webp)).toBe('webp');
  });

  it('refuse un SVG ou un faux fichier image', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectLogoExtension(svg)).toBeNull();
    expect(validateLogoBytes(svg).ok).toBe(false);
  });

  it('refuse un fichier vide ou trop gros', () => {
    expect(validateLogoBytes(new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(png);
    expect(validateLogoBytes(big).ok).toBe(false);
  });

  it('accepte un PNG valide', () => {
    expect(validateLogoBytes(png)).toEqual({ ok: true, value: 'png' });
  });
});
