// Tests pour lib/chunking.ts — la fonction qui découpe un texte en morceaux
// ("chunks") avant de les envoyer à l'embedding/indexation.
//
// Rappel syntaxe Vitest (utilisée dans tous les fichiers *.test.ts) :
// - `describe('nom', () => { ... })` : regroupe plusieurs tests liés, juste
//   pour l'organisation/l'affichage — n'a aucun effet sur le résultat.
// - `it('description', () => { ... })` : un test individuel. La description
//   est juste un texte lisible dans le rapport (peut être en anglais ou
//   français, ça n'a aucune incidence technique).
// - `expect(valeur).toXxx(...)` : l'assertion — "je m'attends à ce que
//   `valeur` corresponde à ceci". Si ce n'est pas le cas, le test échoue.

import { describe, it, expect } from 'vitest';
import { chunkText } from './chunking';

describe('chunkText', () => {
  it('returns nothing for empty input', () => {
    // Un texte vide ne doit produire aucun chunk.
    // `.toEqual(...)` compare le CONTENU (utile pour un tableau/objet) —
    // contrairement à `.toBe(...)` qui compare avec `===` et échouerait
    // même pour deux tableaux vides différents en mémoire.
    expect(chunkText('')).toEqual([]);
  });

  it('packs short plain text (no headings) into a single chunk', () => {
    // Un texte court (sans titres Markdown) doit tenir dans un seul chunk.
    const text = 'Première phrase. Deuxième phrase. Troisième phrase.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1); // vérifie chunks.length === 1
    expect(chunks[0]).toContain('Première phrase.'); // .toContain = "la chaîne contient..."
    expect(chunks[0]).toContain('Troisième phrase.');
  });

  it('splits long plain text into multiple chunks without dropping content', () => {
    // On fabrique un texte volontairement long (~900 mots, bien au-delà de
    // TARGET_TOKENS = 650 ≈ 2600 caractères dans chunking.ts) en répétant
    // une phrase 80 fois, pour forcer un découpage en plusieurs chunks.
    const sentence = 'Ceci est une phrase de test suffisamment longue pour compter. ';
    const text = sentence.repeat(80);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1); // doit avoir été découpé
    // Chaque chunk doit rester proche de la taille cible — pas de chunk
    // géant qui aurait "tout avalé" par erreur.
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThan(3200); // TARGET_CHARS (2600) + marge pour le chevauchement
    }
  });

  it('carries overlap between consecutive plain-text chunks', () => {
    // Le chunker garde volontairement un peu de texte de la fin d'un chunk
    // au début du suivant (le "chevauchement"/overlap), pour ne pas couper
    // une idée en plein milieu entre deux chunks. On vérifie que ce
    // chevauchement existe bien.
    const sentence = 'Phrase numero un deux trois quatre cinq six sept huit neuf dix. ';
    const text = sentence.repeat(60);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);

    // On prend la fin du premier chunk, et on vérifie qu'on la retrouve en
    // tête du deuxième. Pas de comparaison exacte de chaîne (le découpage
    // par phrase peut légèrement varier) — juste les 3 derniers "mots".
    const firstChunkTail = chunks[0].slice(-40);
    expect(chunks[1]).toContain(firstChunkTail.trim().split(' ').slice(-3).join(' '));
  });

  it('routes Markdown (heading) input through the structural strategy, grouping small sections', () => {
    // Si le texte contient des titres Markdown (#, ##...), chunkText doit
    // utiliser la stratégie "structurelle" : regrouper les petites sections
    // ensemble plutôt que de faire un chunk par titre.
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
    // Les deux sections sont courtes → elles doivent être regroupées dans
    // UN SEUL chunk, pas éclatées une par une.
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Section A');
    expect(chunks[0]).toContain('Section B');
  });

  it('keeps an oversized section intact as its own group, falling back to sentence-splitting only that section', () => {
    // Cas particulier : une section Markdown TROP grosse pour tenir dans un
    // seul chunk. Le chunker doit alors la découper par phrases (comme le
    // ferait un texte brut), sans mélanger son contenu avec les petites
    // sections voisines.
    const smallSection = '## Petite section\nContenu court.';
    const bigSentence = 'Phrase longue de remplissage pour dépasser la taille cible. ';
    const bigSection = `## Grande section\n${bigSentence.repeat(60)}`;

    const text = [smallSection, '', bigSection].join('\n');
    const chunks = chunkText(text);

    // La petite section garde son propre chunk. La grosse section est
    // éclatée en plusieurs morceaux (son titre ne survit que dans le
    // premier morceau — le chevauchement récupère les phrases de la FIN
    // du morceau précédent, pas son titre de début).
    expect(chunks.some((c) => c.includes('Petite section'))).toBe(true);
    expect(chunks.some((c) => c.includes('Grande section'))).toBe(true);
    expect(chunks.length).toBeGreaterThan(2); // 1 (petite) + 2+ (grande, découpée)
  });

  it('does not treat a "#" inside a sentence as a heading', () => {
    // Un "#" au milieu d'une phrase ne doit pas être confondu avec un titre
    // Markdown (qui doit être en DÉBUT de ligne, suivi d'un espace).
    const text = 'On parle du symbole # dans ce texte, sans que ce soit un titre Markdown.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });
});
