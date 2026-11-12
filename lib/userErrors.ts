import { logError } from '@/lib/logger';

// Gestion d'erreur côté API : ce que l'utilisateur voit n'est jamais le texte
// brut d'une exception (message Postgres, erreur OpenAI, pile d'appel...).
// Deux familles :
// - une UserFacingError est écrite pour l'utilisateur et s'affiche telle quelle ;
// - tout le reste est journalisé en entier côté serveur avec une référence
//   courte, et l'utilisateur ne reçoit qu'une phrase claire plus cette
//   référence, que le support retrouve dans les logs.
// Sans dépendance serveur : le widget peut importer les messages génériques.

/** Erreur dont le message est rédigé pour l'utilisateur final et sûr à afficher. */
export class UserFacingError extends Error {}

export const GENERIC_ERROR_MESSAGE =
  "Une erreur est survenue de notre côté. Réessayez dans un instant, et si le problème continue, contactez le propriétaire du site.";
export const OVERLOADED_ERROR_MESSAGE =
  'Le service est très sollicité en ce moment. Réessayez dans quelques instants.';
export const TIMEOUT_ERROR_MESSAGE = 'La réponse a pris trop de temps. Réessayez dans un instant.';

/**
 * Texte à montrer pour une réponse HTTP en échec, côté navigateur. Les
 * messages de nos routes sont déjà rédigés pour l'utilisateur, mais un échec
 * de plateforme (504 de Vercel, page HTML d'erreur, passerelle) arrive avec un
 * corps qui ne l'est pas : tout ce qui n'est pas une courte phrase de nos
 * routes est remplacé par un message clair.
 */
export function describeFailedResponse(status: number, body: string): string {
  const text = body.trim();
  if (status === 504 || status === 408) return TIMEOUT_ERROR_MESSAGE;
  if (status === 429 && !text) return OVERLOADED_ERROR_MESSAGE;
  if (!text || status >= 500 || text.length > 300 || text.startsWith('<')) return GENERIC_ERROR_MESSAGE;
  return text;
}

/** Référence courte à citer au support (pas un secret : sert seulement à retrouver une ligne de log). */
export function newErrorRef(): string {
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

function readField(err: unknown, key: string): unknown {
  return typeof err === 'object' && err !== null ? (err as Record<string, unknown>)[key] : undefined;
}

/**
 * Phrase destinée à l'utilisateur pour une erreur inattendue. Reconnaît les
 * deux causes que l'utilisateur peut raisonnablement réessayer (service
 * saturé, délai dépassé) ; le reste reste générique.
 */
export function toUserMessage(err: unknown): string {
  if (err instanceof UserFacingError) return err.message;

  const status = readField(err, 'status');
  const code = String(readField(err, 'code') ?? '');
  const name = String(readField(err, 'name') ?? '');
  const message = err instanceof Error ? err.message.toLowerCase() : '';

  if (status === 429 || code === 'rate_limit_exceeded' || code === 'insufficient_quota') {
    return OVERLOADED_ERROR_MESSAGE;
  }
  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    code === 'ETIMEDOUT' ||
    message.includes('timed out') ||
    message.includes('timeout')
  ) {
    return TIMEOUT_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Message en français pour une erreur Supabase Auth (connexion, inscription,
 * changement d'email ou de mot de passe), qui arrivent sinon en anglais
 * ("Invalid login credentials"). Se base sur le code d'erreur, avec un repli
 * sur le texte pour les anciennes versions du client qui n'en fournissent pas.
 * Les cas qui ne se corrigent pas côté utilisateur restent génériques.
 */
export function describeAuthError(
  err: { code?: string | null; message?: string | null; status?: number | null } | null | undefined
): string {
  const code = err?.code ?? '';
  const text = (err?.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return "Votre adresse email n'est pas encore confirmée. Consultez votre boîte mail.";
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    text.includes('already registered') ||
    text.includes('already been registered')
  ) {
    return 'Un compte existe déjà avec cette adresse email.';
  }
  // Before the weak-password check: "New password should be different from the
  // old password" would otherwise match its "password should be" wording.
  if (code === 'same_password' || text.includes('should be different from the old password')) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (code === 'weak_password' || text.includes('password should be') || text.includes('password is too')) {
    return 'Ce mot de passe est trop faible. Choisissez-en un plus long et plus varié.';
  }
  if (code === 'email_address_invalid' || code === 'validation_failed' || text.includes('invalid format')) {
    return "Cette adresse email n'est pas valide.";
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    err?.status === 429 ||
    text.includes('rate limit')
  ) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  if (code === 'signup_disabled') return 'Les inscriptions sont momentanément fermées.';
  if (
    code === 'session_not_found' ||
    code === 'session_expired' ||
    code === 'not_authenticated' ||
    err?.status === 401 ||
    text.includes('jwt')
  ) {
    return 'Votre session a expiré. Reconnectez-vous puis recommencez.';
  }
  if (code === 'reauthentication_needed') {
    return 'Par sécurité, reconnectez-vous puis recommencez cette action.';
  }
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Message pour une erreur renvoyée par Postgres/PostgREST sur une action de
 * l'utilisateur : les causes courantes sont expliquées, le reste est générique.
 */
export function describeDbError(err: { code?: string | null } | null | undefined): string {
  switch (err?.code) {
    case '23505':
      return 'Cet élément existe déjà.';
    case '23503':
      return "Cette action fait référence à un élément qui n'existe plus.";
    case '23514':
    case '22P02':
      return 'Une des valeurs envoyées est invalide.';
    case '42501':
      return "Vous n'avez pas les droits nécessaires pour cette action.";
    default:
      return GENERIC_ERROR_MESSAGE;
  }
}

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
