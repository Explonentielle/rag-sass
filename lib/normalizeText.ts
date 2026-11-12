/** Casse, accents et ponctuation neutralisés pour comparer ou regrouper des messages. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
