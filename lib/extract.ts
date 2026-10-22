import mammoth from 'mammoth';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { isIP } from 'node:net';
import dns from 'node:dns/promises';
import { logWarn } from '@/lib/logger';
import {
  extractHrefs,
  extractSitemapLocs,
  normalizePageUrl,
  toSameSitePageUrl,
  MAX_SITE_PAGES,
} from '@/lib/siteLinks';

// Below this average of extracted characters per PDF page, we assume the
// PDF is a scanned image with no text layer (OCR is out of scope for now).
const MIN_CHARS_PER_PAGE = 20;

// Row count above which we warn in logs (not block) — CSV/XLSX ingestion
// packs rows into Markdown-like text and runs them through the normal
// chunk/embed/index pipeline. Fine for typical product sheets or price
// lists (hundreds to a few thousand rows); a real bulk catalog sync (tens
// of thousands of rows) belongs to a batch pipeline instead (see
// docs/roadmap.md item 6 note on the OpenAI Batch API), not this endpoint.
const LARGE_SHEET_ROW_WARNING = 5000;

export class UnsupportedDocumentError extends Error {}

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'xlsx';

export function detectFileType(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return null;
}

type TabularRow = Record<string, unknown>;

function isBlankRow(row: TabularRow): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === '');
}

/**
 * Converts parsed rows into synthetic Markdown: one heading per row (so
 * lib/chunking.ts's structural strategy packs several rows per chunk, with
 * headers as context, instead of blindly slicing on character count).
 */
function rowsToMarkdown(rows: TabularRow[], sheetLabel?: string): string {
  return rows
    .filter((row) => !isBlankRow(row))
    .map((row, i) => {
      const heading = sheetLabel ? `### ${sheetLabel} — Ligne ${i + 1}` : `### Ligne ${i + 1}`;
      const fields = Object.entries(row)
        .filter(([key]) => key.trim().length > 0)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n');
      return `${heading}\n${fields}`;
    })
    .join('\n\n');
}

export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  // Markdown is plain text for chunking/embedding purposes — the raw syntax
  // (#, **, ```) adds a little noise but doesn't hurt retrieval quality.
  if (fileType === 'txt' || fileType === 'md') {
    return buffer.toString('utf-8');
  }

  if (fileType === 'docx') {
    // Markdown instead of raw text: Word "Heading" styles come through as
    // #/##/### lines, which lib/chunking.ts uses to chunk by section
    // instead of blind sentence-packing. convertToMarkdown exists at
    // runtime but isn't in mammoth's shipped .d.ts, hence the cast.
    const convertToMarkdown = (
      mammoth as unknown as {
        convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
      }
    ).convertToMarkdown;
    const { value } = await convertToMarkdown({ buffer });
    if (!value.trim()) {
      throw new UnsupportedDocumentError('Ce fichier .docx ne contient aucun texte extractible.');
    }
    return value;
  }

  if (fileType === 'pdf') {
    // pdf-parse has no ESM types export compatible with `import`; require() at
    // call time avoids pulling its debug entrypoint into the route bundle.
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = data.text || '';
    const avgCharsPerPage = data.numpages > 0 ? text.trim().length / data.numpages : 0;

    if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
      throw new UnsupportedDocumentError(
        "Ce PDF semble être un scan/image sans texte extractible. L'OCR n'est pas encore supporté, merci d'uploader un PDF avec du texte natif."
      );
    }

    return text;
  }

  if (fileType === 'csv') {
    let rows: TabularRow[];
    try {
      rows = parseCsv(buffer, { columns: true, skip_empty_lines: true, trim: true }) as TabularRow[];
    } catch (err) {
      throw new UnsupportedDocumentError(
        `Ce fichier .csv n'a pas pu être analysé (format invalide) : ${err instanceof Error ? err.message : 'erreur inconnue'}.`
      );
    }
    if (rows.length === 0) {
      throw new UnsupportedDocumentError('Ce fichier .csv ne contient aucune ligne de données.');
    }
    if (rows.length > LARGE_SHEET_ROW_WARNING) {
      logWarn('extract.large_csv', { rowCount: rows.length });
    }
    return rowsToMarkdown(rows);
  }

  if (fileType === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const multiSheet = workbook.SheetNames.length > 1;
    let totalRows = 0;

    const sections = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<TabularRow>(sheet, { defval: '' });
      totalRows += rows.length;
      return rowsToMarkdown(rows, multiSheet ? sheetName : undefined);
    }).filter((section) => section.length > 0);

    if (sections.length === 0) {
      throw new UnsupportedDocumentError('Ce fichier Excel ne contient aucune ligne de données.');
    }
    if (totalRows > LARGE_SHEET_ROW_WARNING) {
      logWarn('extract.large_xlsx', { rowCount: totalRows, sheetCount: workbook.SheetNames.length });
    }
    return sections.join('\n\n');
  }

  throw new UnsupportedDocumentError(`Type de fichier non supporté: ${fileType}`);
}

// ---------------------------------------------------------------------------
// URL ingestion (docs/roadmap.md item 18, point 5). Scrapes a URL and
// extracts its main content ("reader mode" — same technique as Firefox's
// Reader View, via the same library) before feeding it into the normal
// chunk/embed/index pipeline, same as an uploaded file.
// ---------------------------------------------------------------------------

const URL_FETCH_TIMEOUT_MS = 15_000;
const URL_MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB of raw HTML

/**
 * SSRF guard: refuses to let the server fetch a private/internal/reserved
 * address on a user's behalf, no matter who asked — this fetch is
 * triggered by an authenticated org member, but the request itself
 * originates from our server (on a VPS, possibly alongside other internal
 * services), so a malicious or compromised account could otherwise use
 * this as a path to probe the internal network. Known residual gap: this
 * checks the hostname *before* fetching — a DNS answer that changes
 * between this check and the actual `fetch()` (DNS rebinding), or a
 * redirect to a private address, isn't caught. Acceptable for a pilot
 * behind authenticated access; a bulletproof fix needs a resolver that
 * pins the checked IP for the actual connection.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  if (hostname === 'localhost') {
    throw new UnsupportedDocumentError('Cette URL pointe vers une adresse locale, non autorisée.');
  }

  const addresses = isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true }).catch(() => [])).map((a) => a.address);

  if (addresses.length === 0) {
    throw new UnsupportedDocumentError("Cette adresse n'a pas pu être résolue.");
  }

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new UnsupportedDocumentError('Cette URL pointe vers une adresse réseau privée, non autorisée.');
    }
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, includes cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local, fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local
  return false;
}

// How many redirect hops to follow before giving up (docs/roadmap.md item
// 44, point 2) — each hop is re-validated against assertPublicHostname
// before being followed, rather than letting fetch's own redirect:
// 'follow' chase a redirect to a private address without rechecking it.
const MAX_REDIRECTS = 5;

function assertAllowedUrl(target: URL): void {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new UnsupportedDocumentError('Seules les URL http/https sont autorisées.');
  }
}

async function fetchOneHop(target: URL): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
  try {
    return await fetch(target.toString(), {
      signal: controller.signal,
      // Manual, not 'follow': a redirect target gets its own
      // assertPublicHostname check in the caller's loop before being
      // fetched — 'follow' would chase it straight to a private address
      // without ever re-validating, defeating the SSRF guard entirely.
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CorpusAiBot/1.0; +ingestion)' },
    });
  } catch (err) {
    throw new UnsupportedDocumentError(
      `Impossible de récupérer cette URL : ${err instanceof Error ? err.message : 'erreur réseau'}.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches a public URL with the SSRF guard applied to the URL and to every
 * redirect hop. Returns the final response (2xx) and the URL it came from
 * after redirects. Shared by page extraction and site discovery so both get
 * exactly the same protections.
 */
async function fetchPublicUrl(rawUrl: string): Promise<{ response: Response; url: URL }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedDocumentError('URL invalide.');
  }
  assertAllowedUrl(url);

  let response: Response;
  let redirectCount = 0;

  // Each iteration re-validates the hostname before fetching — including
  // every redirect target, not just the URL the user originally submitted.
  while (true) {
    await assertPublicHostname(url.hostname);
    response = await fetchOneHop(url);

    if (response.status >= 300 && response.status < 400) {
      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        throw new UnsupportedDocumentError('Trop de redirections.');
      }
      const location = response.headers.get('location');
      if (!location) {
        throw new UnsupportedDocumentError('Cette URL redirige sans indiquer de destination.');
      }
      // Resolved against the current URL: a relative Location header
      // (common, e.g. "/login") is otherwise not a valid URL on its own.
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, url);
      } catch {
        throw new UnsupportedDocumentError('Cette URL redirige vers une destination invalide.');
      }
      assertAllowedUrl(nextUrl);
      url = nextUrl;
      continue;
    }

    break;
  }

  if (!response.ok) {
    throw new UnsupportedDocumentError(`Cette URL a répondu avec une erreur (${response.status}).`);
  }
  return { response, url };
}

async function readBoundedText(response: Response): Promise<string> {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf-8') > URL_MAX_RESPONSE_BYTES) {
    throw new UnsupportedDocumentError('Cette page est trop volumineuse.');
  }
  return text;
}

async function fetchPublicHtml(rawUrl: string): Promise<{ html: string; url: URL }> {
  const { response, url } = await fetchPublicUrl(rawUrl);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new UnsupportedDocumentError(
      "Cette URL ne renvoie pas une page web (HTML) — seules les pages web sont supportées pour l'instant."
    );
  }
  return { html: await readBoundedText(response), url };
}

/**
 * Fetches a URL and extracts its main textual content, stripping
 * navigation/ads/footers via Readability — the same extraction engine
 * behind Firefox's Reader View. Returns plain text, ready for the same
 * chunk/embed/index pipeline as an uploaded file's extracted text.
 */
export async function extractFromUrl(rawUrl: string): Promise<string> {
  const { html, url } = await fetchPublicHtml(rawUrl);

  const dom = new JSDOM(html, { url: url.toString() });
  const article = new Readability(dom.window.document).parse();

  if (!article?.textContent || article.textContent.trim().length < 50) {
    throw new UnsupportedDocumentError("Aucun contenu principal exploitable n'a été trouvé sur cette page.");
  }

  return article.textContent.trim();
}

// ---------------------------------------------------------------------------
// Whole-site discovery (docs/roadmap.md item 50): lists the pages of the site
// a URL belongs to, so each can then be ingested as its own document through
// the normal single-URL pipeline above. Sources: the site's sitemap.xml when
// there is one, plus the links found on the start page and on the pages it
// links to (two levels: enough for a typical brochure site whose navigation
// is on every page). Every fetch goes through fetchPublicUrl, so the SSRF
// guard and redirect re-validation apply to each page and to the sitemap.
// ---------------------------------------------------------------------------

const MAX_CHILD_SITEMAPS = 3;
const DISCOVERY_BATCH_SIZE = 5;

async function readSitemapLocs(origin: string): Promise<string[]> {
  const fetchLocs = async (sitemapUrl: string) => {
    const { response } = await fetchPublicUrl(sitemapUrl);
    return extractSitemapLocs(await readBoundedText(response));
  };

  const locs = await fetchLocs(`${origin}/sitemap.xml`);
  // A sitemap index lists other sitemaps rather than pages.
  const childSitemaps = locs.filter((loc) => /\.xml(\.gz)?$/i.test(loc)).slice(0, MAX_CHILD_SITEMAPS);
  const pages = locs.filter((loc) => !/\.xml(\.gz)?$/i.test(loc));
  for (const child of childSitemaps) {
    const childLocs = await fetchLocs(child).catch(() => []);
    pages.push(...childLocs);
  }
  return pages;
}

/**
 * Returns up to `maxPages` normalized page URLs of the site `rawUrl` belongs
 * to, starting with `rawUrl` itself (as reached after redirects). Throws
 * UnsupportedDocumentError only if the start page itself can't be fetched;
 * a missing sitemap or an unreachable linked page is simply skipped.
 */
export async function discoverSiteUrls(rawUrl: string, maxPages = MAX_SITE_PAGES): Promise<string[]> {
  const { html: startHtml, url: start } = await fetchPublicHtml(rawUrl);
  const found = new Set<string>([normalizePageUrl(start)]);

  const add = (href: string, base: URL): string | null => {
    if (found.size >= maxPages) return null;
    const page = toSameSitePageUrl(href, base);
    if (!page || found.has(page)) return null;
    found.add(page);
    return page;
  };

  const sitemapLocs = await readSitemapLocs(start.origin).catch(() => []);
  for (const loc of sitemapLocs) add(loc, start);

  const linkedFromStart = extractHrefs(startHtml)
    .map((href) => add(href, start))
    .filter((page): page is string => page !== null);

  for (let i = 0; i < linkedFromStart.length && found.size < maxPages; i += DISCOVERY_BATCH_SIZE) {
    const batch = linkedFromStart.slice(i, i + DISCOVERY_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((page) => fetchPublicHtml(page)));
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const href of extractHrefs(result.value.html)) add(href, result.value.url);
    }
  }

  return Array.from(found);
}
