// Tests pour lib/prompts.ts — les templates de prompt système prêts à
// l'emploi, et la fonction qui construit le prompt final envoyé au modèle.

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, getPromptTemplate, PROMPT_TEMPLATES } from './prompts';

describe('getPromptTemplate', () => {
  it('finds a known template by id', () => {
    // `?.` (optional chaining) : si getPromptTemplate renvoyait undefined,
    // `?.label` renverrait undefined au lieu de planter — utile ici car on
    // veut que le test échoue proprement (label !== 'Closer / vente')
    // plutôt qu'avec une erreur "Cannot read property of undefined".
    expect(getPromptTemplate('closer-vente')?.label).toBe('Closer / vente');
  });

  it('returns undefined for an unknown id', () => {
    expect(getPromptTemplate('does-not-exist')).toBeUndefined();
  });

  it('every template has a non-empty id, label and template', () => {
    // Vérification "globale" : on boucle sur TOUS les templates existants
    // (PROMPT_TEMPLATES) plutôt que d'en tester un par un — si quelqu'un
    // ajoute un nouveau template mal rempli plus tard, ce test le détecte
    // automatiquement sans avoir besoin d'être mis à jour.
    for (const t of PROMPT_TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.template.length).toBeGreaterThan(0);
    }
  });
});

describe('buildSystemPrompt', () => {
  const template = 'Tu es un assistant de test.';

  it('wraps the template with retrieved context chunks, citing sources', () => {
    // Cas normal (RAG) : des chunks de documents ont été retrouvés, ils
    // doivent apparaître dans le prompt final avec leur nom de fichier
    // source.
    const prompt = buildSystemPrompt({
      systemPromptTemplate: template,
      contextChunks: [
        { content: 'Le délai est de 14 jours.', document_filename: 'contrat.pdf' },
        { content: 'Les horaires sont 9h-18h.', document_filename: 'faq.md' },
      ],
    });

    // `.toContain(...)` : vérifie qu'une sous-chaîne est présente, sans
    // exiger une correspondance exacte du prompt entier (qui contient
    // aussi du texte d'instruction autour).
    expect(prompt).toContain(template);
    expect(prompt).toContain('contrat.pdf');
    expect(prompt).toContain('Le délai est de 14 jours.');
    expect(prompt).toContain('faq.md');
    expect(prompt).toContain('UNIQUE source de vérité');
  });

  it('says explicitly when no relevant chunks were found', () => {
    // Si la recherche ne renvoie aucun chunk pertinent, le prompt doit
    // quand même le dire clairement au modèle plutôt que de laisser un vide.
    const prompt = buildSystemPrompt({ systemPromptTemplate: template, contextChunks: [] });
    expect(prompt).toContain('Aucun document pertinent trouvé');
  });

  it('sends the template as-is when useDocuments is false, with no document wrapper', () => {
    // Mode "prompt seul" (chatbot sans documents, roadmap item 32) : le
    // template doit partir tel quel, SANS aucun habillage "réponds à
    // partir des documents" — sinon le modèle refuserait de répondre
    // puisqu'il n'y a jamais de chunk à citer dans ce mode.
    const prompt = buildSystemPrompt({
      systemPromptTemplate: template,
      contextChunks: [{ content: 'Ne devrait pas apparaître.', document_filename: 'x.pdf' }],
      useDocuments: false,
    });

    expect(prompt).toBe(template); // égalité stricte : rien d'ajouté
    expect(prompt).not.toContain('x.pdf'); // les chunks fournis sont bien ignorés
    expect(prompt).not.toContain('UNIQUE source de vérité');
  });
});
