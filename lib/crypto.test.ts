import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptText, decryptText } from './crypto';

// A fresh, throwaway key generated for this test run only — never reads or
// touches the project's real .env / CONVERSATION_ENCRYPTION_KEY.
const TEST_KEY = randomBytes(32).toString('base64');
const ENV_VAR = 'CONVERSATION_ENCRYPTION_KEY';
const originalValue = process.env[ENV_VAR];

beforeEach(() => {
  process.env[ENV_VAR] = TEST_KEY;
});

afterEach(() => {
  if (originalValue === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = originalValue;
});

describe('encryptText / decryptText', () => {
  it('round-trips plaintext through encryption', () => {
    const plaintext = 'Quel est le délai de rétractation prévu au contrat ?';
    const ciphertext = encryptText(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.split(':')).toHaveLength(3); // iv:authTag:data
    expect(decryptText(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'Même message, deux chiffrements.';
    expect(encryptText(plaintext)).not.toBe(encryptText(plaintext));
  });

  it('handles empty strings', () => {
    expect(decryptText(encryptText(''))).toBe('');
  });

  it('passes through legacy plaintext rows unchanged (pre-dates this feature)', () => {
    const legacyPlaintext = 'Un message stocké avant le passage au chiffrement.';
    expect(decryptText(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('passes through ordinary plaintext unchanged', () => {
    const clearlyPlaintext = 'Bonjour, comment allez-vous ?';
    expect(decryptText(clearlyPlaintext)).toBe(clearlyPlaintext);
  });

  it('known limitation: plaintext that happens to look like 3 base64 segments is misdetected as ciphertext and throws', () => {
    // CIPHERTEXT_PATTERN is a heuristic (see lib/crypto.ts) — real chat text
    // essentially never has this exact "word:word:word" base64-alphabet
    // shape, but nothing stops it in principle. Documenting the failure
    // mode here rather than asserting it never happens.
    const coincidentallyShaped = 'pas:du:chiffrement';
    expect(() => decryptText(coincidentallyShaped)).toThrow();
  });

  it('throws a clear error when the encryption key env var is missing', () => {
    delete process.env[ENV_VAR];
    expect(() => encryptText('test')).toThrow(/CONVERSATION_ENCRYPTION_KEY manquante/);
  });

  it('throws a clear error when the encryption key is not 32 bytes', () => {
    process.env[ENV_VAR] = Buffer.from('too-short').toString('base64');
    expect(() => encryptText('test')).toThrow(/doit décoder en 32 octets/);
  });
});
