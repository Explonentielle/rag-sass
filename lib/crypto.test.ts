// Tests pour lib/crypto.ts — le chiffrement applicatif des messages de
// conversation stockés en base (roadmap.md item 20-C).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptText, decryptText, UNREADABLE_PLACEHOLDER } from './crypto';

// decryptText logs (logError) instead of throwing on failure — mock the
// logger so the test suite doesn't write real files to ./logs, same as
// rateLimit.test.ts.
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }));

// On génère une clé factice, jetable, juste pour ce run de tests — ce
// fichier ne lit et ne touche JAMAIS le vrai .env / la vraie variable
// CONVERSATION_ENCRYPTION_KEY du projet.
const TEST_KEY = randomBytes(32).toString('base64');
const ENV_VAR = 'CONVERSATION_ENCRYPTION_KEY';
const originalValue = process.env[ENV_VAR]; // au cas où quelque chose l'aurait déjà définie

// `beforeEach`/`afterEach` : s'exécutent avant/après CHAQUE test du fichier
// (pas seulement d'un bloc describe précis, vu qu'ils sont déclarés hors de
// tout describe ici — ils s'appliquent à tout). On pose la fausse clé avant
// chaque test, et on restaure l'état d'origine après — pour qu'un test qui
// modifie/supprime la variable (voir plus bas) n'affecte pas les suivants.
beforeEach(() => {
  process.env[ENV_VAR] = TEST_KEY;
});

afterEach(() => {
  if (originalValue === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = originalValue;
});

describe('encryptText / decryptText', () => {
  it('round-trips plaintext through encryption', () => {
    // "Round-trip" = chiffrer puis déchiffrer doit redonner exactement le
    // texte d'origine.
    const plaintext = 'Quel est le délai de rétractation prévu au contrat ?';
    const ciphertext = encryptText(plaintext);

    expect(ciphertext).not.toBe(plaintext); // c'est bien chiffré, pas identique
    // Le format attendu est "iv:authTag:données" (3 segments séparés par ":").
    expect(ciphertext.split(':')).toHaveLength(3);
    expect(decryptText(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    // Chaque appel à encryptText utilise un IV (vecteur d'initialisation)
    // aléatoire différent — chiffrer deux fois le même message doit donc
    // donner deux résultats différents (propriété de sécurité importante :
    // sinon, on pourrait repérer que deux messages chiffrés sont identiques
    // sans même les déchiffrer).
    const plaintext = 'Même message, deux chiffrements.';
    expect(encryptText(plaintext)).not.toBe(encryptText(plaintext));
  });

  it('handles empty strings', () => {
    // Cas limite qui a révélé un vrai bug (corrigé dans lib/crypto.ts,
    // voir docs/roadmap.md item 15) : chiffrer une chaîne vide produit un
    // ciphertext dont le segment "données" est lui-même vide. Le motif de
    // détection (CIPHERTEXT_PATTERN) ne le reconnaissait pas comme du
    // vrai ciphertext, donc decryptText le renvoyait tel quel au lieu de
    // le déchiffrer. Ce test garantit que ça ne se reproduit pas.
    expect(decryptText(encryptText(''))).toBe('');
  });

  it('passes through legacy plaintext rows unchanged (pre-dates this feature)', () => {
    // Les messages stockés AVANT la mise en place du chiffrement restent en
    // clair en base (pas de migration de données) — decryptText doit les
    // reconnaître comme "pas du ciphertext" et les renvoyer tels quels,
    // sans planter.
    const legacyPlaintext = 'Un message stocké avant le passage au chiffrement.';
    expect(decryptText(legacyPlaintext)).toBe(legacyPlaintext);
  });

  it('passes through ordinary plaintext unchanged', () => {
    const clearlyPlaintext = 'Bonjour, comment allez-vous ?';
    expect(decryptText(clearlyPlaintext)).toBe(clearlyPlaintext);
  });

  it('returns the placeholder instead of throwing for plaintext that happens to look like 3 base64 segments', () => {
    // CIPHERTEXT_PATTERN (dans lib/crypto.ts) est une heuristique : il
    // reconnaît un ciphertext à sa FORME (3 segments façon base64 séparés
    // par ":"), pas à un marqueur explicite. Un texte en clair qui, par
    // pur hasard, a exactement cette forme ("mot:mot:mot" en alphabet
    // base64) sera donc À TORT considéré comme du ciphertext — mais
    // decryptText ne plante plus dans ce cas (voir les deux tests
    // suivants : AUCUN appel ne doit faire planter toute une page), il
    // renvoie le texte de substitution comme pour tout autre échec.
    const coincidentallyShaped = 'pas:du:chiffrement';
    expect(decryptText(coincidentallyShaped)).toBe(UNREADABLE_PLACEHOLDER);
  });

  it('never throws on a decrypt failure — returns a placeholder instead (one bad message must not crash a whole page)', () => {
    // Cas réel qui a fait planter la page d'un chatbot en production :
    // deux machines pointant sur la même base Supabase, mais avec des
    // CONVERSATION_ENCRYPTION_KEY différentes — un message chiffré avec
    // une clé ne peut pas être déchiffré avec l'autre. decryptText doit
    // absorber cet échec, pas le laisser remonter et planter toute la page.
    const ciphertext = encryptText('Message chiffré avec la bonne clé.');
    process.env[ENV_VAR] = randomBytes(32).toString('base64'); // une autre clé, valide mais différente
    expect(decryptText(ciphertext)).toBe(UNREADABLE_PLACEHOLDER);
  });

  it('returns the placeholder instead of throwing when the encryption key env var is missing', () => {
    // getKey() lève toujours une erreur en interne ("CONVERSATION_ENCRYPTION_KEY
    // manquante") — mais decryptText l'attrape désormais, comme n'importe
    // quel autre échec de déchiffrement.
    const ciphertext = encryptText('Un message.');
    delete process.env[ENV_VAR];
    expect(decryptText(ciphertext)).toBe(UNREADABLE_PLACEHOLDER);
  });

  it('encryptText still throws a clear error when the key env var is missing (encrypting a NEW message must stay blocking)', () => {
    // Différent de decryptText : chiffrer un nouveau message sans clé doit
    // rester bloquant — l'enregistrer silencieusement en clair (faute de
    // pouvoir le chiffrer) serait pire que planter.
    delete process.env[ENV_VAR];
    // Le deuxième argument de `.toThrow(...)` peut être une regex : le
    // test vérifie que le message d'erreur contient bien ce texte, pas
    // juste qu'une erreur quelconque a été levée.
    expect(() => encryptText('test')).toThrow(/CONVERSATION_ENCRYPTION_KEY manquante/);
  });

  it('throws a clear error when the encryption key is not 32 bytes', () => {
    // AES-256 exige une clé de 32 octets pile — une clé plus courte doit
    // déclencher une erreur explicite plutôt qu'un échec silencieux ou
    // cryptique.
    process.env[ENV_VAR] = Buffer.from('too-short').toString('base64');
    expect(() => encryptText('test')).toThrow(/doit décoder en 32 octets/);
  });
});
