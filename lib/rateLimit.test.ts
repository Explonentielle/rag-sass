import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, checkPublicChatRateLimit, getClientIp } from './rateLimit';

// The blacklist path calls lib/logger.ts's logError, which writes to disk
// (./logs) — mock it so running the suite doesn't leave real log files
// behind.
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }));

// checkRateLimit/checkPublicChatRateLimit share module-level state (buckets,
// blacklist) with no reset hook — every test uses a fresh, random key/IP so
// tests never see each other's counters.
let counter = 0;
function uniqueKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe('getClientIp', () => {
  it('uses the first address in x-forwarded-for', () => {
    const req = new Request('http://test', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('http://test', { headers: { 'x-real-ip': '203.0.113.9' } });
    expect(getClientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to "unknown" with no proxy headers', () => {
    const req = new Request('http://test');
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  it('allows the first 20 requests in a window and blocks the 21st', () => {
    const key = uniqueKey('window');
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the count once the window has elapsed', () => {
    vi.useFakeTimers();
    try {
      const key = uniqueKey('reset');
      vi.setSystemTime(0);
      for (let i = 0; i < 20; i++) checkRateLimit(key);
      expect(checkRateLimit(key).allowed).toBe(false);

      vi.setSystemTime(61_000); // past the 60s window
      expect(checkRateLimit(key).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('checkPublicChatRateLimit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('blacklists an IP that exhausts two consecutive windows', () => {
    const chatbotId = uniqueKey('bot');
    const ip = `198.51.100.${counter}`; // unique-ish per test run

    vi.setSystemTime(0);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, ip);

    vi.setSystemTime(61_000); // next window
    let last;
    for (let i = 0; i < 22; i++) last = checkPublicChatRateLimit(chatbotId, ip);

    expect(last).toEqual({ allowed: false, blacklisted: true });

    // Blacklisted — rejected immediately even on a fresh window, no more
    // counting needed.
    vi.setSystemTime(122_000);
    expect(checkPublicChatRateLimit(chatbotId, ip)).toEqual({ allowed: false, blacklisted: true });
  });

  it('never blacklists the "unknown" fallback IP', () => {
    const chatbotId = uniqueKey('bot');
    vi.setSystemTime(0);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, 'unknown');
    vi.setSystemTime(61_000);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, 'unknown');

    const result = checkPublicChatRateLimit(chatbotId, 'unknown');
    expect(result.blacklisted).toBeUndefined();
  });

  it('does not blacklist a single exhausted window (one-off burst)', () => {
    const chatbotId = uniqueKey('bot');
    const ip = `198.51.100.${counter + 100}`;

    vi.setSystemTime(0);
    let last;
    for (let i = 0; i < 22; i++) last = checkPublicChatRateLimit(chatbotId, ip);

    expect(last).toMatchObject({ allowed: false });
    expect((last as { blacklisted?: boolean }).blacklisted).toBeUndefined();
  });
});
