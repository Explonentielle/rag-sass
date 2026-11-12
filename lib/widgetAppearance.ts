// Personnalisation du widget public (docs/roadmap.md item 60). Pur et sans
// dépendance serveur : utilisé par les routes API (validation), le
// formulaire du dashboard (limites affichées) et le widget (type des props).

export const MAX_BOT_NAME_CHARS = 40;
export const MAX_WELCOME_MESSAGE_CHARS = 400;
export const MAX_SUGGESTED_QUESTIONS = 4;
export const MAX_SUGGESTED_QUESTION_CHARS = 100;
export const MAX_LOGO_BYTES = 512 * 1024;

export interface WidgetAppearance {
  botName: string | null;
  logoUrl: string | null;
  welcomeMessage: string | null;
  suggestedQuestions: string[];
  /** Affiche « Propulsé par Corpus.ai » (plans sans marque blanche). */
  showBranding: boolean;
}

/** Assemble les colonnes d'un chatbot en props pour le widget. */
export function toWidgetAppearance(
  row: {
    bot_name: string | null;
    welcome_message: string | null;
    suggested_questions: string[] | null;
  },
  extra: { logoUrl: string | null; showBranding: boolean }
): WidgetAppearance {
  return {
    botName: row.bot_name,
    logoUrl: extra.logoUrl,
    welcomeMessage: row.welcome_message,
    suggestedQuestions: row.suggested_questions ?? [],
    showBranding: extra.showBranding,
  };
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** null ou chaîne vide efface la valeur ; sinon texte rogné d'au plus `maxChars` caractères. */
export function parseOptionalText(input: unknown, label: string, maxChars: number): ParseResult<string | null> {
  if (input === null) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, error: `${label} doit être une chaîne (ou null).` };
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > maxChars) {
    return { ok: false, error: `${label} est trop long (${maxChars} caractères maximum).` };
  }
  return { ok: true, value: trimmed };
}

/** null ou liste vide efface ; sinon 4 questions maximum, sans doublon, 100 caractères chacune. */
export function parseSuggestedQuestions(input: unknown): ParseResult<string[] | null> {
  if (input === null) return { ok: true, value: null };
  if (!Array.isArray(input) || !input.every((q) => typeof q === 'string')) {
    return { ok: false, error: 'suggestedQuestions doit être un tableau de chaînes (ou null).' };
  }
  const questions = Array.from(new Set(input.map((q: string) => q.trim()).filter(Boolean)));
  if (questions.length === 0) return { ok: true, value: null };
  if (questions.length > MAX_SUGGESTED_QUESTIONS) {
    return { ok: false, error: `${MAX_SUGGESTED_QUESTIONS} questions suggérées au maximum.` };
  }
  if (questions.some((q) => q.length > MAX_SUGGESTED_QUESTION_CHARS)) {
    return {
      ok: false,
      error: `Chaque question suggérée doit faire ${MAX_SUGGESTED_QUESTION_CHARS} caractères au maximum.`,
    };
  }
  return { ok: true, value: questions };
}

export const LOGO_CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
} as const;

export type LogoExtension = keyof typeof LOGO_CONTENT_TYPES;

/** Type réel du fichier d'après ses premiers octets (le type annoncé par le navigateur ne suffit pas). */
export function detectLogoExtension(bytes: Uint8Array): LogoExtension | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export function validateLogoBytes(bytes: Uint8Array): ParseResult<LogoExtension> {
  if (bytes.length === 0) return { ok: false, error: 'Fichier vide.' };
  if (bytes.length > MAX_LOGO_BYTES) {
    return { ok: false, error: `Le logo dépasse ${MAX_LOGO_BYTES / 1024} Ko.` };
  }
  const ext = detectLogoExtension(bytes);
  if (!ext) return { ok: false, error: 'Format non supporté (PNG, JPEG ou WebP uniquement).' };
  return { ok: true, value: ext };
}
