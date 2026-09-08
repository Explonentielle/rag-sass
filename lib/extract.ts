import mammoth from 'mammoth';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
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
