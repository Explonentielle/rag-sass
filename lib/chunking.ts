/**
 * Sentence-aware chunker.
 *
 * Strategy (flagged as a judgment call, not derived from the spec):
 * - Split on sentence boundaries first, then greedily pack sentences into
 *   chunks up to a target size, so we (almost) never cut mid-sentence.
 * - Token counts are estimated at ~4 chars/token (no tokenizer dependency).
 *   Good enough for sizing chunks; not used for anything billed.
 * - Overlap is achieved by carrying the last few sentences of a chunk into
 *   the start of the next one, so context isn't lost at chunk boundaries.
 * - A single sentence longer than the target size is hard-split by
 *   character count as a fallback (rare, but avoids unbounded chunks).
 */

const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 650; // middle of the requested 500-800 range
const OVERLAP_TOKENS = 80; // ~12% overlap

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  // Split after sentence-ending punctuation followed by whitespace, or on
  // blank lines (paragraph breaks), keeping the punctuation attached.
  const rough = normalized.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ü0-9"'(])|\n\s*\n/g);
  return rough.map((s) => s.trim()).filter((s) => s.length > 0);
}

function hardSplit(sentence: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < sentence.length; i += TARGET_CHARS) {
    parts.push(sentence.slice(i, i + TARGET_CHARS));
  }
  return parts;
}

export function chunkText(text: string): string[] {
  const sentences = splitIntoSentences(text).flatMap((s) =>
    s.length > TARGET_CHARS ? hardSplit(s) : [s]
  );

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push(current.join(' ').trim());
  };

  for (const sentence of sentences) {
    const sentenceLen = sentence.length + 1;

    if (currentLen + sentenceLen > TARGET_CHARS && current.length > 0) {
      flush();

      // Carry trailing sentences into the next chunk for overlap.
      let overlap: string[] = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const len = current[i].length + 1;
        if (overlapLen + len > OVERLAP_CHARS) break;
        overlap.unshift(current[i]);
        overlapLen += len;
      }

      current = overlap;
      currentLen = overlapLen;
    }

    current.push(sentence);
    currentLen += sentenceLen;
  }

  flush();

  return chunks.filter((c) => c.length > 0);
}
