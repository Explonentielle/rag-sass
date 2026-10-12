// Default loading-indicator rotation (docs/roadmap.md item 47) — neutral
// and professional, since this is what every chatbot shows out of the box
// to real visitors of real businesses (a plumber's site, a medical
// secretary's FAQ...), not just Corpus.ai's own demo. An owner who wants
// something more playful for their brand can override it per chatbot
// (chatbots.loading_messages, migration 0015) — this is only the fallback.
export const DEFAULT_LOADING_MESSAGES = [
  'Je réfléchis...',
  "J'analyse votre question...",
  'Je cherche dans les documents...',
  'Un instant...',
];

/** Resolves a chatbot's effective loading messages: its own custom list if
 * non-empty, otherwise the app default. */
export function resolveLoadingMessages(custom: string[] | null | undefined): string[] {
  const trimmed = (custom ?? []).map((m) => m.trim()).filter(Boolean);
  return trimmed.length > 0 ? trimmed : DEFAULT_LOADING_MESSAGES;
}
