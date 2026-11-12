import type { FileExtractionStatus } from '@/types/database';
import { extractText, detectFileType } from '@/lib/extract';
import { truncateExtractedText } from '@/lib/fileContext';
import { logWarn } from '@/lib/logger';

// Lecture d'un fichier envoyé par un visiteur (docs/roadmap.md item 63),
// réutilisant les extracteurs de l'ingestion : texte natif des PDF, DOCX,
// tableurs, TXT, et OCR pour les scans et les images.

// Au-delà, on abandonne la lecture (le fichier reste enregistré) plutôt que de
// bloquer le visiteur devant un spinner : un OCR lent ne doit pas faire expirer
// la requête d'envoi.
export const EXTRACTION_TIMEOUT_MS = 40_000;

export interface FileExtraction {
  status: FileExtractionStatus;
  text: string | null;
  truncated: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('délai dépassé')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Ne lève jamais : un fichier illisible donne un statut, pas une erreur d'envoi. */
export async function analyzeVisitorFile(
  data: Buffer,
  filename: string,
  logCtx: Record<string, unknown> = {}
): Promise<FileExtraction> {
  const fileType = detectFileType(filename);
  if (!fileType) return { status: 'failed', text: null, truncated: false };

  let raw: string;
  try {
    raw = await withTimeout(extractText(data, fileType, filename), EXTRACTION_TIMEOUT_MS);
  } catch (err) {
    // Reason only, never the filename or content — see the GDPR note in lib/logger.ts.
    logWarn('visitor_file_analysis.failed', {
      ...logCtx,
      fileType,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'failed', text: null, truncated: false };
  }

  const trimmed = raw.trim();
  if (!trimmed) return { status: 'empty', text: null, truncated: false };

  const { text, truncated } = truncateExtractedText(trimmed);
  return { status: 'ok', text, truncated };
}
