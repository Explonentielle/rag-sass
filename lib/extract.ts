import mammoth from 'mammoth';

// Below this average of extracted characters per PDF page, we assume the
// PDF is a scanned image with no text layer (OCR is out of scope for now).
const MIN_CHARS_PER_PAGE = 20;

export class UnsupportedDocumentError extends Error {}

export type SupportedFileType = 'pdf' | 'docx' | 'txt' | 'md';

export function detectFileType(filename: string): SupportedFileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  return null;
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

  throw new UnsupportedDocumentError(`Type de fichier non supporté: ${fileType}`);
}
