import { logError } from '@/lib/logger';

/**
 * Logs a Supabase query's error (if any) and returns its `data` either way
 * — for the many places in the dashboard that render `data ?? []` directly
 * and would otherwise silently treat "the query failed" as "there's
 * nothing to show" (roadmap.md item 38's follow-up: not a crash risk like
 * the throwing lib/ functions, but a real DB failure disappearing with
 * zero trace anywhere is its own problem). The caller's rendering logic
 * doesn't change — a failed query still shows as empty — but the failure
 * is now always in the local logs instead of invisible.
 */
// Takes `data`/`error` as two separate arguments rather than one
// `{data, error}` object — Supabase's actual response type is a
// discriminated union (not a plain `{data: T|null, error: E|null}` shape),
// which confuses generic inference when passed as a single object and can
// silently collapse T to `never`. Destructuring at the call site first
// avoids that entirely.
export function logQueryError<T>(
  event: string,
  context: Record<string, unknown>,
  data: T | null,
  error: { message: string } | null
): T | null {
  if (error) {
    logError(event, { ...context, error: error.message });
  }
  return data;
}
