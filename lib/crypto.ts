import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { logError } from '@/lib/logger';

// Application-level encryption for stored chat messages (roadmap.md item
// 20-C). Protects `content`/`sources` against anyone with direct DB access
// (e.g. the service-role key) — Supabase's own at-rest encryption already
// covers disk theft, this covers the DB-access case that doesn't.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // NIST-recommended for GCM

function getKey(): Buffer {
  const raw = process.env.CONVERSATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'CONVERSATION_ENCRYPTION_KEY manquante. Générez-en une avec `openssl rand -base64 32` ' +
        'et ajoutez-la à .env.local (voir docs/roadmap.md item 20-C).'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'CONVERSATION_ENCRYPTION_KEY invalide : doit décoder en 32 octets (AES-256). ' +
        'Régénérez-la avec `openssl rand -base64 32`.'
    );
  }
  return key;
}

// A ciphertext blob looks like base64(iv):base64(authTag):base64(data) —
// three pure-base64 segments joined by colons. Real chat text essentially
// never matches this shape, so it doubles as a cheap legacy-row detector:
// rows written before this feature existed stay readable as plaintext
// instead of throwing, without a data migration.
// Data segment allows zero base64 chars (not `+`) — encrypting an empty
// string still produces a real iv/authTag pair with empty ciphertext data,
// and that's a legitimate ciphertext blob, not legacy plaintext to skip.
const CIPHERTEXT_PATTERN = /^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]*=*$/;

export function encryptText(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export const UNREADABLE_PLACEHOLDER = '[message illisible]';

/**
 * Decrypts a ciphertext blob produced by encryptText — returns legacy rows
 * (pre-dating this feature) unchanged, see CIPHERTEXT_PATTERN above.
 *
 * Never throws: a message a reader can't decrypt (missing/rotated
 * CONVERSATION_ENCRYPTION_KEY, corrupted row) must not take down the whole
 * page it's rendered on — one unreadable message becomes a placeholder,
 * not a 500 for every conversation on the chatbot. The failure is still
 * logged so a real key mismatch/corruption doesn't go unnoticed.
 */
export function decryptText(payload: string): string {
  if (!CIPHERTEXT_PATTERN.test(payload)) return payload;

  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logError('crypto.decrypt_failed', { error: err instanceof Error ? err.message : String(err) });
    return UNREADABLE_PLACEHOLDER;
  }
}
