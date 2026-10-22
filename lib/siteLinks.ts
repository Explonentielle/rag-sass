// Pure helpers for "scan the whole site" URL ingestion (docs/roadmap.md item
// 50): pull links out of a page or a sitemap and keep only the ones that are
// pages of the same site. No network and no DOM library here, so it can be
// unit-tested directly; fetching lives in lib/extract.ts (discoverSiteUrls).

export const MAX_SITE_PAGES = 30;

const NON_PAGE_EXTENSION =
  /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|csv|zip|rar|gz|mp4|webm|mov|mp3|wav|woff2?|ttf|otf|eot|docx?|xlsx?|pptx?)$/i;

const NON_PAGE_PATH_PREFIXES = ['/_next/', '/api/', '/cdn-cgi/', '/wp-admin/', '/wp-json/', '/wp-content/'];

const NAMED_ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Raw href values of every <a> tag in the HTML, entity-decoded. */
export function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const re = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? '';
    if (raw.trim()) hrefs.push(decodeEntities(raw.trim()));
  }
  return hrefs;
}

/** <loc> entries of a sitemap.xml (or of a sitemap index). */
export function extractSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    locs.push(decodeEntities(match[1]));
  }
  return locs;
}

function siteKey(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Canonical form used both to dedupe discovered pages and to recognise pages
 * already added as documents: no fragment, no query string (mostly tracking
 * parameters on a brochure site), no trailing slash except for the root.
 */
export function normalizePageUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.hash = '';
  copy.search = '';
  if (copy.pathname.length > 1) copy.pathname = copy.pathname.replace(/\/+$/, '');
  return copy.toString();
}

/**
 * Resolves `href` against the page it was found on and returns the
 * normalized URL if it's a page of the same site (www. and the bare domain
 * count as the same site), or null for anything else: other domains,
 * mailto:/tel:/javascript:, files (PDF, images...), framework assets.
 */
export function toSameSitePageUrl(href: string, base: URL): string | null {
  let target: URL;
  try {
    target = new URL(href, base);
  } catch {
    return null;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  if (siteKey(target.hostname) !== siteKey(base.hostname)) return null;
  if (NON_PAGE_EXTENSION.test(target.pathname)) return null;
  if (NON_PAGE_PATH_PREFIXES.some((prefix) => target.pathname.startsWith(prefix))) return null;
  return normalizePageUrl(target);
}
