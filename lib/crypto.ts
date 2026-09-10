import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

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

/** Decrypts a ciphertext blob produced by encryptText — returns legacy rows
 * (pre-dating this feature) unchanged, see CIPHERTEXT_PATTERN above. */
export function decryptText(payload: string): string {
  if (!CIPHERTEXT_PATTERN.test(payload)) return payload;

  const [ivB64, tagB64, dataB64] = payload.split(':');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
