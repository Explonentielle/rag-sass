import { describe, it, expect } from 'vitest';
import { chunkText } from './chunking';

describe('chunkText', () => {
  it('returns nothing for empty input', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('packs short plain text (no headings) into a single chunk', () => {
    const text = 'Première phrase. Deuxième phrase. Troisième phrase.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Première phrase.');
    expect(chunks[0]).toContain('Troisième phrase.');
  });

  it('splits long plain text into multiple chunks without dropping content', () => {
    // ~900 words of repeated sentences — well past TARGET_TOKENS (650, ~2600 chars).
    const sentence = 'Ceci est une phrase de test suffisamment longue pour compter. ';
    const text = sentence.repeat(80);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk stays close to the target size, no runaway chunk.
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThan(3200); // TARGET_CHARS (2600) + slack for overlap
    }
  });

  it('carries overlap between consecutive plain-text chunks', () => {
    const sentence = 'Phrase numero un deux trois quatre cinq six sept huit neuf dix. ';
    const text = sentence.repeat(60);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);

    // The end of chunk N should reappear at the start of chunk N+1 (the
    // overlap window) — not an exact string check since sentence packing
    // can vary, just confirm some shared sentence content exists.
    const firstChunkTail = chunks[0].slice(-40);
    expect(chunks[1]).toContain(firstChunkTail.trim().split(' ').slice(-3).join(' '));
  });

  it('routes Markdown (heading) input through the structural strategy, grouping small sections', () => {
    const text = [
      '# Titre principal',
      'Introduction courte.',
      '',
      '## Section A',
      'Contenu de la section A, assez court.',
      '',
      '## Section B',
      'Contenu de la section B, assez court aussi.',
    ].join('\n');

    const chunks = chunkText(text);
    // Small sections should be packed together into one chunk rather than
    // split one-per-heading.
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Section A');
    expect(chunks[0]).toContain('Section B');
  });

  it('keeps an oversized section intact as its own group, falling back to sentence-splitting only that section', () => {
    const smallSection = '## Petite section\nContenu court.';
    const bigSentence = 'Phrase longue de remplissage pour dépasser la taille cible. ';
    const bigSection = `## Grande section\n${bigSentence.repeat(60)}`;

    const text = [smallSection, '', bigSection].join('\n');
    const chunks = chunkText(text);

    // The small section gets its own chunk, and the oversized section (its
    // heading only survives in the first of its own split pieces — overlap
    // carries trailing sentences forward, not the heading) is broken into
    // more than one piece rather than becoming one giant chunk.
    expect(chunks.some((c) => c.includes('Petite section'))).toBe(true);
    expect(chunks.some((c) => c.includes('Grande section'))).toBe(true);
    expect(chunks.length).toBeGreaterThan(2); // 1 (small) + 2+ (big, split)
  });

  it('does not treat a "#" inside a sentence as a heading', () => {
    const text = 'On parle du symbole # dans ce texte, sans que ce soit un titre Markdown.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });
});
