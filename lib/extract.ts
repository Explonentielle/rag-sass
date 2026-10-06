import mammoth from 'mammoth';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { isIP } from 'node:net';
import dns from 'node:dns/promises';
import { logWarn } from '@/lib/logger';

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

/**
 * Fetches a URL and extracts its main textual content, stripping
 * navigation/ads/footers via Readability — the same extraction engine
 * behind Firefox's Reader View. Returns plain text, ready for the same
 * chunk/embed/index pipeline as an uploaded file's extracted text.
 */
export async function extractFromUrl(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsupportedDocumentError('URL invalide.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsupportedDocumentError('Seules les URL http/https sont autorisées.');
  }

  await assertPublicHostname(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CorpusAiBot/1.0; +ingestion)' },
    });
  } catch (err) {
    throw new UnsupportedDocumentError(
      `Impossible de récupérer cette URL : ${err instanceof Error ? err.message : 'erreur réseau'}.`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new UnsupportedDocumentError(`Cette URL a répondu avec une erreur (${response.status}).`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    throw new UnsupportedDocumentError(
      "Cette URL ne renvoie pas une page web (HTML) — seules les pages web sont supportées pour l'instant."
    );
  }

  const html = await response.text();
  if (Buffer.byteLength(html, 'utf-8') > URL_MAX_RESPONSE_BYTES) {
    throw new UnsupportedDocumentError('Cette page est trop volumineuse.');
  }

  const dom = new JSDOM(html, { url: url.toString() });
  const article = new Readability(dom.window.document).parse();

  if (!article?.textContent || article.textContent.trim().length < 50) {
    throw new UnsupportedDocumentError("Aucun contenu principal exploitable n'a été trouvé sur cette page.");
  }

  return article.textContent.trim();
}
