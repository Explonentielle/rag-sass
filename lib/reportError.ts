import { logError } from '@/lib/logger';
import {
  GENERIC_ERROR_MESSAGE,
  UserFacingError,
  describeDbError,
  newErrorRef,
  toUserMessage,
} from '@/lib/userErrors';

// Partie SERVEUR de la gestion d'erreur : journalise l'erreur complète et
// renvoie le message à montrer. Séparée de lib/userErrors.ts parce que le
// journal (lib/logger.ts) écrit dans le système de fichiers : un composant du
// navigateur qui importerait ce module ferait échouer le build.

/**
 * Journalise l'erreur en entier (message, pile, contexte) avec une référence,
 * et renvoie le message à montrer. La référence est ajoutée seulement aux
 * erreurs inattendues : une UserFacingError n'a rien à faire retrouver dans
 * les logs.
 */
export function reportError(
  event: string,
  err: unknown,
  ctx: Record<string, unknown> = {}
): { message: string; ref: string } {
  const ref = newErrorRef();
  const userFacing = err instanceof UserFacingError;
  logError(event, {
    ...ctx,
    ref,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  const message = toUserMessage(err);
  return { message: userFacing ? message : `${message} (réf. ${ref})`, ref };
}

/** Pareil pour une erreur de base de données renvoyée sous forme { code, message } (pas une exception). */
export function reportDbError(
  event: string,
  dbError: { code?: string | null; message: string },
  ctx: Record<string, unknown> = {}
): { message: string; ref: string } {
  const ref = newErrorRef();
  logError(event, { ...ctx, ref, code: dbError.code, error: dbError.message });
  const base = describeDbError(dbError);
  return { message: base === GENERIC_ERROR_MESSAGE ? `${base} (réf. ${ref})` : base, ref };
}
