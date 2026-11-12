import mammoth from 'mammoth';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { assertPublicHostname as assertPublicHost, BlockedAddressError } from '@/lib/ssrfGuard';
import { logWarn } from '@/lib/logger';
import { UserFacingError } from '@/lib/userErrors';
import { runOcr } from '@/lib/ocrService';
import { transcribeAudio } from '@/lib/openai';
import {
  extractHrefs,
  extractSitemapLocs,
  normalizePageUrl,
  toSameSitePageUrl,
  MAX_SITE_PAGES,
} from '@/lib/siteLinks';

// Below this average of extracted characters per PDF page, we assume the
// PDF is a scanned image with no text layer, and fall back to the OCR
// service (see runOcr below).
const MIN_CHARS_PER_PAGE = 20;

// Flat minimum (not per-page, unlike MIN_CHARS_PER_PAGE above) below which
// the OCR service's own output is considered a failure too (e.g. a blank
// or unreadable scan) rather than a usable result.
const MIN_OCR_CHARS = 50;

// Images have no "native text" to fall back from — they always go
// straight through OCR (runOcr detects the actual format itself from the
// file's bytes, see lib/ocrService.ts).
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

// Formats acceptés par l'API de transcription (docs/roadmap.md item 46) —
// webm/mp4 couvrent ce que produit l'enregistreur du dashboard
// (components/AudioRecorder.tsx) selon le navigateur, les autres pour un
// fichier audio uploadé directement (ex. export Zoom/Teams).
const AUDIO_EXTENSIONS = new Set(['webm', 'mp4', 'm4a', 'mp3', 'wav', 'mpga', 'mpeg']);

// Marge sous la limite de 25 Mo de l'API Whisper (~90 minutes à 32 kbit/s,
// le débit fixé par l'enregistreur du dashboard) : rejeté proprement plutôt
// que de laisser échouer l'appel à l'API avec une erreur moins claire.
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

// Row count above which we warn in logs (not block) — CSV/XLSX ingestion
// packs rows into Markdown-like text and runs them through the normal
// chunk/embed/index pipeline. Fine for typical product sheets or price
// lists (hundreds to a few thousand rows); a real bulk catalog sync (tens
// of thousands of rows) belongs to a batch pipeline instead (see
// docs/roadmap.md item 6 note on the OpenAI Batch API), not this endpoint.
const LARGE_SHEET_ROW_WARNING = 5000;

// Written for the end user (every throw site uses a French sentence), so it
// is safe to show as is — see lib/userErrors.ts.
export class UnsupportedDocumentError extends UserFacingError {}

/**
 * Shared tail for the two cases that need OCR: a scanned PDF (no native
 * text) and a plain image (never has native text). `context` is a French
 * sentence describing what's being OCR'd, used to build a clear error if
 * OCR fails or comes back empty.
 */
async function ocrOrThrow(buffer: Buffer, context: string): Promise<string> {
  const ocrText = await runOcr(buffer).catch((err) => {
    // The service's own error text (network, auth, HTTP status) is for the
    // logs, not for the person who uploaded the file.
    logWarn('ocr.failed', { error: err instanceof Error ? err.message : String(err) });
    throw new UnsupportedDocumentError(
      `${context} Le service de lecture des scans est momentanément indisponible, réessayez dans quelques minutes.`
    );
  });

  if (!ocrText || ocrText.trim().length < MIN_OCR_CHARS) {
    throw new UnsupportedDocumentError(`${context} L'OCR n'y a trouvé aucun texte lisible.`);
  }

  return ocrText;
}

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'xlsx' | 'image' | 'audio';

export function detectFileType(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext && IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (ext && AUDIO_EXTENSIONS.has(ext)) return 'audio';
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

export async function extractText(
  buffer: Buffer,
  fileType: SupportedFileType,
  // Nom d'origine, utilisé seulement par la branche 'audio' (extension
  // réelle transmise à l'API de transcription) — les autres branches n'en
  // ont pas besoin, le type suffit.
  filename?: string
): Promise<string> {
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
      return ocrOrThrow(buffer, 'Ce PDF semble être un scan/image sans texte extractible.');
    }

    return text;
  }

  if (fileType === 'image') {
    return ocrOrThrow(buffer, 'Cette image ne contient aucun texte extractible nativement.');
  }

  if (fileType === 'audio') {
    if (buffer.length > MAX_AUDIO_BYTES) {
      throw new UnsupportedDocumentError(
        `Cet enregistrement est trop volumineux pour être transcrit (limite ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))} Mo, environ 90 minutes).`
      );
    }
    const text = await transcribeAudio(buffer, filename || 'audio.webm').catch((err) => {
      throw new UnsupportedDocumentError(
        `La transcription a échoué : ${err instanceof Error ? err.message : 'erreur inconnue'}.`
      );
    });
    if (!text.trim()) {
      throw new UnsupportedDocumentError("La transcription n'a produit aucun texte exploitable.");
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
 * SSRF guard (the logic lives in lib/ssrfGuard.ts, shared with outgoing
 * webhooks): refuses to let the server fetch a private/internal/reserved
 * address on a user's behalf. Here it only maps the guard's error onto
 * UnsupportedDocumentError, which is what callers of this file expect.
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  try {
    await assertPublicHost(hostname);
  } catch (err) {
    if (err instanceof BlockedAddressError) throw new UnsupportedDocumentError(err.message);
    throw err;
  }
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
      "Cette URL ne renvoie pas une page web (HTML), seules les pages web sont supportées pour l'instant."
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
