/**
 * Chunker with two strategies:
 *
 * 1. Structural (preferred when the text has Markdown headings — native
 *    .md files, and .docx converted to Markdown in lib/extract.ts so Word
 *    heading styles carry through): split at heading boundaries first, so
 *    a section never gets split mid-thought and short related sections get
 *    packed together up to the target size. Only a single section that's
 *    still too big on its own falls through to strategy 2, applied just to
 *    that section's text.
 * 2. Sentence-based (fallback for PDFs and plain text with no heading
 *    structure): the original approach — split on sentence boundaries,
 *    greedily pack into a target size, with overlap between chunks.
 *
 * Token counts are estimated at ~4 chars/token (no tokenizer dependency) —
 * good enough for sizing chunks, not used for anything billed.
 */

const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 650; // middle of the requested 500-800 range
const OVERLAP_TOKENS = 80; // ~12% overlap, sentence-based strategy only

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

const HEADING_PATTERN = /^#{1,6}\s+\S/;

function hasMarkdownHeadings(text: string): boolean {
  return text.split('\n').some((line) => HEADING_PATTERN.test(line.trim()));
}

export function chunkText(text: string): string[] {
  return hasMarkdownHeadings(text) ? chunkByStructure(text) : chunkBySentences(text);
}

// ---------------------------------------------------------------------------
// Strategy 1: structural (heading-aware)
// ---------------------------------------------------------------------------

interface Block {
  heading: string | null;
  text: string; // heading line + body, or just body if no heading precedes it
}

function splitIntoBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join('\n').trim();
    const blockText = heading ? `${heading}\n${body}`.trim() : body;
    if (blockText.length > 0) blocks.push({ heading, text: blockText });
  };

  for (const line of lines) {
    if (HEADING_PATTERN.test(line.trim())) {
      flush();
      heading = line.trim();
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }
  flush();

  return blocks;
}

function chunkByStructure(text: string): string[] {
  const blocks = splitIntoBlocks(text);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flushCurrent = () => {
    if (current.length > 0) chunks.push(current.join('\n\n').trim());
  };

  for (const block of blocks) {
    if (block.text.length > TARGET_CHARS) {
      // A single section is already too big on its own: flush whatever was
      // being packed, then fall back to sentence-packing just this section
      // (still tagged with its heading, so context isn't lost).
      flushCurrent();
      current = [];
      currentLen = 0;
      chunks.push(...chunkBySentences(block.text));
      continue;
    }

    const blockLen = block.text.length + 2;
    if (currentLen + blockLen > TARGET_CHARS && current.length > 0) {
      flushCurrent();
      current = [];
      currentLen = 0;
    }
    current.push(block.text);
    currentLen += blockLen;
  }
  flushCurrent();

  return chunks.filter((c) => c.length > 0);
}

// ---------------------------------------------------------------------------
// Strategy 2: sentence-based (original approach, also used as the fallback
// for an oversized section under strategy 1)
// ---------------------------------------------------------------------------

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

function chunkBySentences(text: string): string[] {
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
