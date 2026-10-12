// Limits and validation for files a visitor sends in the chat widget
// (docs/roadmap.md item 48). Pure and dependency-free so the widget (client)
// and the upload route (server) apply the same rules.

// Vercel rejects request bodies above 4.5 MB and uploads are proxied through
// our API route, so stay safely under that.
export const MAX_VISITOR_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_CONVERSATION = 5;

// Allowlist by extension. The stored Content-Type comes from this map, never
// from what the client declares, so a file can't be served back as HTML/SVG.
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

export const VISITOR_FILE_ACCEPT = Object.keys(ALLOWED_CONTENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

export const VISITOR_FILE_TYPES_LABEL = Object.keys(ALLOWED_CONTENT_TYPES)
  .map((ext) => ext.toUpperCase())
  .join(', ');

export type VisitorFileValidation =
  | { ok: true; contentType: string }
  | { ok: false; error: string };

export function getFileExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return null;
  return filename.slice(dot + 1).toLowerCase();
}

export function validateVisitorFile(filename: string, sizeBytes: number): VisitorFileValidation {
  if (sizeBytes <= 0) return { ok: false, error: 'Ce fichier est vide.' };
  if (sizeBytes > MAX_VISITOR_FILE_BYTES) {
    return {
      ok: false,
      error: `Ce fichier est trop volumineux (${MAX_VISITOR_FILE_BYTES / (1024 * 1024)} Mo maximum).`,
    };
  }
  const extension = getFileExtension(filename);
  const contentType = extension ? ALLOWED_CONTENT_TYPES[extension] : undefined;
  if (!contentType) {
    return { ok: false, error: `Type de fichier non accepté (acceptés : ${VISITOR_FILE_TYPES_LABEL}).` };
  }
  return { ok: true, contentType };
}

/** Filename safe to embed in a storage path: no separators, no accents, no
 * leading dots; keeps the end of the name so the extension survives. */
export function sanitizeFilenameForPath(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^\.+/, '');
  return (cleaned || 'fichier').slice(-80);
}
