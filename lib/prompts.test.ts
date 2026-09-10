import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, getPromptTemplate, PROMPT_TEMPLATES } from './prompts';

describe('getPromptTemplate', () => {
  it('finds a known template by id', () => {
    expect(getPromptTemplate('closer-vente')?.label).toBe('Closer / vente');
  });

  it('returns undefined for an unknown id', () => {
    expect(getPromptTemplate('does-not-exist')).toBeUndefined();
  });

  it('every template has a non-empty id, label and template', () => {
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
    const prompt = buildSystemPrompt({
      systemPromptTemplate: template,
      contextChunks: [
        { content: 'Le délai est de 14 jours.', document_filename: 'contrat.pdf' },
        { content: 'Les horaires sont 9h-18h.', document_filename: 'faq.md' },
      ],
    });

    expect(prompt).toContain(template);
    expect(prompt).toContain('contrat.pdf');
    expect(prompt).toContain('Le délai est de 14 jours.');
    expect(prompt).toContain('faq.md');
    expect(prompt).toContain('UNIQUE source de vérité');
  });

  it('says explicitly when no relevant chunks were found', () => {
    const prompt = buildSystemPrompt({ systemPromptTemplate: template, contextChunks: [] });
    expect(prompt).toContain('Aucun document pertinent trouvé');
  });

  it('sends the template as-is when useDocuments is false, with no document wrapper', () => {
    const prompt = buildSystemPrompt({
      systemPromptTemplate: template,
      contextChunks: [{ content: 'Ne devrait pas apparaître.', document_filename: 'x.pdf' }],
      useDocuments: false,
    });

    expect(prompt).toBe(template);
    expect(prompt).not.toContain('x.pdf');
    expect(prompt).not.toContain('UNIQUE source de vérité');
  });
});
