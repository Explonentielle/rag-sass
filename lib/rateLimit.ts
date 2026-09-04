// In-memory rate limiter — no third-party service, consistent with
// lib/logger.ts. Works for a single long-running server process (local dev,
// a self-hosted VPS). Doesn't share state across multiple instances or
// serverless invocations — each would get its own independent limit. Good
// enough for the pilot; revisit (shared store, e.g. Redis) if deployed
// behind a load balancer with several instances.

import { logError } from '@/lib/logger';

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

// Periodic sweep so `buckets` doesn't grow unbounded on a long-running
// process — expired entries are harmless but there's no reason to keep them.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}, WINDOW_MS).unref();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** Best-effort client IP from standard proxy headers; 'unknown' with no proxy in front (e.g. local dev). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

// --- IP blacklist for the public chat endpoint --------------------------
// A legitimate visitor essentially never exhausts the 20 req/60s window
// even once (a real conversation runs at a fraction of that rate — see
// docs/roadmap.md item 10). Exhausting it twice in a row (two consecutive
// windows) is a strong signal of an automated abuser rather than a human,
// so at that point we blacklist the IP: further requests are rejected
// immediately, before touching the DB/Elasticsearch/OpenAI, capping the
// real cost of an attack at roughly two windows' worth of requests instead
// of running forever. Global per-IP (not per chatbotId) so rotating
// through several known chatbotIds doesn't reset the streak.

const BLACKLIST_DURATION_MS = 24 * 60 * 60 * 1000; // long enough to stop a live abuser, short enough that a reassigned IP (mobile carrier NAT) isn't locked out forever.

interface IpViolation {
  lastWindowStart: number;
  consecutiveWindows: number;
}

const ipViolations = new Map<string, IpViolation>();
const blacklist = new Map<string, number>(); // ip -> expiresAt

function isBlacklisted(ip: string): boolean {
  if (ip === 'unknown') return false; // never blacklist the no-proxy-header fallback — would lock out every visitor behind it
  const expiresAt = blacklist.get(ip);
  if (expiresAt === undefined) return false;
  if (Date.now() > expiresAt) {
    blacklist.delete(ip);
    return false;
  }
  return true;
}

// Called only when a request for `ip` was just rate-limited. Counts
// *windows* exhausted, not individual blocked requests, so a burst of
// retries within one blocked window only counts once.
function recordViolation(ip: string, windowStart: number): void {
  if (ip === 'unknown') return;
  const existing = ipViolations.get(ip);
  if (existing?.lastWindowStart === windowStart) return; // already counted this window

  const isConsecutive = existing && windowStart - existing.lastWindowStart <= WINDOW_MS * 1.5;
  const consecutiveWindows = isConsecutive ? existing!.consecutiveWindows + 1 : 1;
  ipViolations.set(ip, { lastWindowStart: windowStart, consecutiveWindows });

  if (consecutiveWindows >= 2) {
    blacklist.set(ip, Date.now() + BLACKLIST_DURATION_MS);
    ipViolations.delete(ip);
    logError('rateLimit.ip_blacklisted', { ip, consecutiveWindows });
  }
}

/**
 * Rate limiting + blacklist for the public, unauthenticated chat endpoint.
 * Wraps checkRateLimit with the IP-blacklist logic above.
 */
export function checkPublicChatRateLimit(
  chatbotId: string,
  ip: string
): { allowed: boolean; retryAfterSeconds?: number; blacklisted?: boolean } {
  if (isBlacklisted(ip)) {
    return { allowed: false, blacklisted: true };
  }

  const key = `public-chat:${chatbotId}:${ip}`;
  const result = checkRateLimit(key);
  if (!result.allowed) {
    const bucket = buckets.get(key);
    if (bucket) recordViolation(ip, bucket.windowStart);
  }
  return result;
}
