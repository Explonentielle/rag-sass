import type { FileExtractionStatus } from '@/types/database';

// Texte des fichiers envoyés par le visiteur, mis en forme pour le prompt du
// modèle (docs/roadmap.md item 63). Pur et sans dépendance : testable seul,
// et importable par les routes de chat sans embarquer les extracteurs de
// documents (lib/extract.ts).

// Limites en caractères (≈ 4 par token) : un fichier ne peut pas à lui seul
// saturer le contexte, et l'ensemble des fichiers d'une conversation pèse au
// plus ~10 000 tokens par message, puisque le texte est renvoyé au modèle à
// chaque question tant que la conversation continue.
export const MAX_EXTRACTED_CHARS_PER_FILE = 30_000;
export const MAX_FILE_CONTEXT_CHARS = 40_000;

export interface FileContextEntry {
  filename: string;
  status: FileExtractionStatus | null;
  text: string | null;
  truncated: boolean;
}

export function truncateExtractedText(
  text: string,
  max: number = MAX_EXTRACTED_CHARS_PER_FILE
): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

/** Un fichier dont on a du texte exploitable (compte comme "contexte" pour le chat). */
export function hasReadableText(entry: FileContextEntry): boolean {
  return entry.status === 'ok' && !!entry.text;
}

/**
 * Bloc ajouté au prompt système : le contenu de chaque fichier, délimité et
 * étiqueté comme une donnée fournie par l'interlocuteur (jamais une
 * instruction, voir VISITOR_FILE_ANALYSIS_PROMPT_NOTE). Un fichier illisible
 * est signalé tel quel pour que le modèle ne prétende pas l'avoir lu. Chaîne
 * vide s'il n'y a aucun fichier.
 */
export function buildFileContextBlock(
  files: FileContextEntry[],
  maxTotalChars: number = MAX_FILE_CONTEXT_CHARS
): string {
  if (files.length === 0) return '';

  let remaining = maxTotalChars;
  const parts = files.map((file) => {
    const name = file.filename.replace(/[«»\n\r]/g, ' ').trim();

    if (!hasReadableText(file)) {
      const why = file.status === 'empty' ? 'aucun texte lisible' : 'lecture impossible';
      return `[Fichier « ${name} » : ${why}. Tu n'as pas pu lire son contenu.]`;
    }
    if (remaining <= 0) {
      return `[Fichier « ${name} » : contenu non inclus faute de place.]`;
    }

    const text = file.text as string;
    const slice = text.slice(0, remaining);
    remaining -= slice.length;
    const cut = file.truncated || slice.length < text.length;
    return `[Début du fichier « ${name} »]\n${slice}\n[Fin du fichier « ${name} »${cut ? ' : contenu tronqué, la suite n\'a pas été lue' : ''}]`;
  });

  return `Fichiers envoyés par l'interlocuteur dans cette conversation :\n\n${parts.join('\n\n')}`;
}
