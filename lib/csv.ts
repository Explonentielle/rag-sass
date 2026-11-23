// Minimal RFC 4180 CSV writer: no library pulled in for the one export
// route that needs it (app/api/chatbots/[id]/export/route.ts).

/** Escapes one value for CSV: quotes it (doubling inner quotes) only if it contains a comma, quote or newline. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Joins already-escaped-on-demand values into one CSV row (no trailing line break). */
export function toCsvRow(values: (string | null | undefined)[]): string {
  return values.map((v) => escapeCsvField(v ?? '')).join(',');
}

/**
 * Builds a full CSV document from rows of values, CRLF-separated (RFC 4180)
 * with a leading UTF-8 BOM so Excel (the realistic target reader for this
 * app's French SMB users) detects the encoding instead of mangling accents.
 * @param rows Each inner array is one row, already in column order.
 * @returns The complete CSV text, ready to send as a response body.
 */
export function buildCsv(rows: (string | null | undefined)[][]): string {
  return '﻿' + rows.map(toCsvRow).join('\r\n') + '\r\n';
}
