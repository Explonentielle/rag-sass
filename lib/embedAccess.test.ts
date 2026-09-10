import { describe, it, expect } from 'vitest';
import { getRequestOrigin, isOriginAllowed, normalizeOrigin } from './embedAccess';

describe('getRequestOrigin', () => {
  it('prefers the Origin header', () => {
    const req = new Request('http://api.test', {
      headers: { origin: 'https://client-site.com', referer: 'https://other.com/page' },
    });
    expect(getRequestOrigin(req)).toBe('https://client-site.com');
  });

  it('falls back to the Referer header origin when Origin is missing', () => {
    const req = new Request('http://api.test', {
      headers: { referer: 'https://client-site.com/some/page?x=1' },
    });
    expect(getRequestOrigin(req)).toBe('https://client-site.com');
  });

  it('returns null when neither header is present', () => {
    const req = new Request('http://api.test');
    expect(getRequestOrigin(req)).toBeNull();
  });

  it('returns null for an unparseable Referer', () => {
    const req = new Request('http://api.test', { headers: { referer: 'not a url' } });
    expect(getRequestOrigin(req)).toBeNull();
  });
});

describe('isOriginAllowed', () => {
  it('allows any origin when the allowlist is empty (opt-in model)', () => {
    expect(isOriginAllowed('https://anything.com', [])).toBe(true);
    expect(isOriginAllowed(null, [])).toBe(true);
  });

  it('allows an origin present in the allowlist', () => {
    expect(isOriginAllowed('https://client-site.com', ['https://client-site.com'])).toBe(true);
  });

  it('rejects an origin not in a non-empty allowlist', () => {
    expect(isOriginAllowed('https://evil.com', ['https://client-site.com'])).toBe(false);
  });

  it('rejects a null origin once an allowlist is set', () => {
    expect(isOriginAllowed(null, ['https://client-site.com'])).toBe(false);
  });
});

describe('normalizeOrigin', () => {
  it('strips path, query, and trailing slash down to scheme://host[:port]', () => {
    expect(normalizeOrigin('https://client-site.com/some/page?x=1')).toBe('https://client-site.com');
    expect(normalizeOrigin('https://client-site.com:8080/')).toBe('https://client-site.com:8080');
  });

  it('trims whitespace from pasted input', () => {
    expect(normalizeOrigin('  https://client-site.com  ')).toBe('https://client-site.com');
  });

  it('returns null for input that is not an absolute URL', () => {
    expect(normalizeOrigin('client-site.com')).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
  });
});
