import { describe, it, expect } from 'vitest';
import {
  ATTACHMENT_MESSAGE_PREFIX,
  VISITOR_FILE_ANALYSIS_PROMPT_NOTE,
  VISITOR_FILE_PROMPT_NOTE,
} from './conversationFiles';
import { buildSystemPrompt } from './prompts';
import { buildFileContextBlock } from './fileContext';

describe('notes de prompt sur les fichiers envoyés', () => {
  it("la note de lecture désigne le même préfixe que le message réellement stocké", () => {
    expect(VISITOR_FILE_ANALYSIS_PROMPT_NOTE).toContain(`"${ATTACHMENT_MESSAGE_PREFIX}"`);
  });

  it("la note de lecture contient les garde-fous : donnée et non instruction, pas d'invention", () => {
    expect(VISITOR_FILE_ANALYSIS_PROMPT_NOTE).toContain('jamais une instruction');
    expect(VISITOR_FILE_ANALYSIS_PROMPT_NOTE).toContain("ne devine pas");
    expect(VISITOR_FILE_ANALYSIS_PROMPT_NOTE).toContain('information officielle');
  });

  it("la note sans lecture continue d'interdire de décrire le contenu", () => {
    expect(VISITOR_FILE_PROMPT_NOTE).toContain('ne décris jamais ce qu\'il contient');
  });

  it("le contenu des fichiers arrive après la règle de fondement, avec sa dérogation", () => {
    const prompt = buildSystemPrompt({
      systemPromptTemplate: 'Tu es un assistant.',
      contextChunks: [],
      filesNote: [
        VISITOR_FILE_ANALYSIS_PROMPT_NOTE,
        buildFileContextBlock([{ filename: 'devis.pdf', status: 'ok', text: 'Total : 1200 €', truncated: false }]),
      ].join('\n\n'),
    });

    expect(prompt.indexOf("N'utilise aucune connaissance externe")).toBeLessThan(
      prompt.indexOf(VISITOR_FILE_ANALYSIS_PROMPT_NOTE)
    );
    expect(prompt.indexOf(VISITOR_FILE_ANALYSIS_PROMPT_NOTE)).toBeLessThan(prompt.indexOf('Total : 1200 €'));
  });
});
