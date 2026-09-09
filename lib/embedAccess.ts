// Access control for anonymous chatbot embeds (docs/integration.md,
// docs/roadmap.md item 22). No Node-only APIs here — imported from both
// app/api/public-chat/route.ts (Node) and middleware.ts (Edge runtime).

/** Origin of the request itself — Origin header for fetch/XHR calls, falling
 * back to Referer's origin (some cross-site navigations omit Origin). */
export function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** Empty allowlist = no restriction (opt-in model — existing embeds keep
 * working until an owner explicitly locks one down). */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

/**
 * Normalizes a user-typed origin (from the chatbot's embed settings form)
 * down to scheme://host[:port] — what the Origin header actually contains,
 * so a pasted full URL (with a path, trailing slash...) still matches.
 * Returns null for input that isn't a parseable absolute URL.
 */
export function normalizeOrigin(input: string): string | null {
  try {
    return new URL(input.trim()).origin;
  } catch {
    return null;
  }
}
