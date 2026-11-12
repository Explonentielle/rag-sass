// Messages de politesse ou de conversation, qui ne sont pas des questions sur
// les documents (docs/roadmap.md item 59). Les nouveaux messages sont classés à
// la source (rewriteQuery, lib/openai.ts) ; cette règle simple nettoie en plus
// les statistiques des messages déjà enregistrés avant cette classification.
// Volontairement prudente : en cas de doute, un message reste une vraie question.

import { normalizeQuestion } from '@/lib/normalizeText';

const SMALL_TALK_WORDS = new Set([
  'bonjour', 'bonsoir', 'salut', 'hello', 'coucou', 'hey', 'hi',
  'merci', 'mercie', 'remercie', 'beaucoup', 'infiniment',
  'ok', 'okay', 'okk', 'daccord', 'd', 'accord', 'entendu', 'compris', 'recu',
  'super', 'parfait', 'genial', 'top', 'cool', 'nickel', 'impec', 'excellent', 'bravo', 'bien', 'tres',
  'oui', 'non', 'ouais', 'ben', 'bah', 'hmm', 'ah', 'oh', 'lol', 'mdr',
  'bye', 'aurevoir', 'au', 'revoir', 'bonne', 'journee', 'soiree', 'a', 'bientot', 'plus',
  'ca', 'va', 'comment', 'allez', 'vous', 'tu', 'et', 'toi',
]);

// Remarques sur le chat lui-même ("tu bug ?", "tu m'entends ?").
const CHAT_REMARK_PATTERNS = [
  /\b(tu|vous) (bug|bugue|bugs|plante|plantes|rame|repond|reponds|marche|fonctionne|m entend|m entendez|es la|etes la)\b/,
  /\bca (bug|bugue|plante|marche|fonctionne)\b/,
];

const MAX_SMALL_TALK_WORDS = 6;

export function isSmallTalk(text: string): boolean {
  const normalized = normalizeQuestion(text);
  if (!normalized) return true;
  if (CHAT_REMARK_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const words = normalized.split(' ');
  return words.length <= MAX_SMALL_TALK_WORDS && words.every((word) => SMALL_TALK_WORDS.has(word));
}
