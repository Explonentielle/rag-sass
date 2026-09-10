// Tests pour lib/rateLimit.ts — le limiteur de débit (anti-spam) du chat
// public, et son blacklist automatique d'IP.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, checkPublicChatRateLimit, getClientIp } from './rateLimit';

// `vi.mock(...)` remplace ENTIÈREMENT un module par une fausse version,
// avant même que le code testé ne l'importe. Ici : quand rateLimit.ts fait
// `import { logError } from '@/lib/logger'`, il reçoit cette fausse version
// au lieu du vrai fichier — qui, lui, écrit un vrai fichier sur disque
// (dossier ./logs) à chaque appel. Sans ce mock, lancer les tests
// laisserait de faux logs d'incident dans le vrai dossier logs/.
// `vi.fn()` crée une fonction factice : elle ne fait rien, mais Vitest
// garde en mémoire qu'elle a été appelée (utile si on voulait vérifier
// "est-ce que logError a bien été appelé ?", pas utilisé ici).
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), logWarn: vi.fn(), logInfo: vi.fn() }));

// checkRateLimit/checkPublicChatRateLimit gardent leur état (compteurs de
// requêtes, liste noire) dans des `Map` au niveau du fichier rateLimit.ts —
// PARTAGÉES par tous les tests de ce fichier, sans aucun moyen de les
// vider entre deux tests. Si deux tests utilisaient la même clé/IP, le
// deuxième verrait les compteurs laissés par le premier et donnerait un
// résultat faux. `uniqueKey()` fabrique donc une chaîne différente à
// chaque appel, pour que chaque test parte d'un compteur à zéro.
let counter = 0;
function uniqueKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

describe('getClientIp', () => {
  it('uses the first address in x-forwarded-for', () => {
    // x-forwarded-for peut contenir plusieurs IP séparées par des virgules
    // (chaîne de proxys) — on veut toujours la première (celle du vrai
    // visiteur).
    const req = new Request('http://test', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('http://test', { headers: { 'x-real-ip': '203.0.113.9' } });
    expect(getClientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to "unknown" with no proxy headers', () => {
    // En local (dev), sans proxy devant l'app, aucun de ces en-têtes n'existe.
    const req = new Request('http://test');
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  it('allows the first 20 requests in a window and blocks the 21st', () => {
    const key = uniqueKey('window');
    // Les 20 premiers appels avec la même clé doivent être autorisés.
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
    }
    // Le 21e, dans la même fenêtre de 60s, doit être refusé.
    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets the count once the window has elapsed', () => {
    // La fenêtre de rate limiting dure 60 secondes réelles — hors de
    // question d'attendre 60 vraies secondes à chaque test (ça rendrait la
    // suite complète atrocement lente). `vi.useFakeTimers()` remplace
    // l'horloge système par une horloge factice qu'on contrôle nous-mêmes ;
    // `vi.setSystemTime(x)` dit "on est à l'instant x (en millisecondes)".
    // Le code testé (rateLimit.ts) ne sait pas que le temps est simulé —
    // il appelle juste `Date.now()` normalement, qui répond ce qu'on lui a
    // dit de répondre.
    vi.useFakeTimers();
    try {
      const key = uniqueKey('reset');
      vi.setSystemTime(0); // "on est à l'instant 0"
      for (let i = 0; i < 20; i++) checkRateLimit(key);
      expect(checkRateLimit(key).allowed).toBe(false); // fenêtre épuisée

      vi.setSystemTime(61_000); // on avance instantanément à +61 secondes
      expect(checkRateLimit(key).allowed).toBe(true); // nouvelle fenêtre → repart à zéro
    } finally {
      // `try/finally` : même si une assertion échoue au-dessus, on remet
      // toujours la vraie horloge avant de continuer — sinon les tests
      // suivants tourneraient avec le temps figé par erreur.
      vi.useRealTimers();
    }
  });
});

describe('checkPublicChatRateLimit', () => {
  // `beforeEach`/`afterEach` : du code qui s'exécute automatiquement avant/
  // après CHAQUE `it()` de ce bloc `describe`, sans avoir à le répéter dans
  // chaque test. Ici : horloge factice avant, vraie horloge après.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('blacklists an IP that exhausts two consecutive windows', () => {
    const chatbotId = uniqueKey('bot');
    const ip = `198.51.100.${counter}`; // IP unique par test (voir uniqueKey)

    // Fenêtre 1 (instant 0) : 22 requêtes → épuise la fenêtre une fois
    // (20 passent, 21e/22e bloquées).
    vi.setSystemTime(0);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, ip);

    // Fenêtre 2 (instant 61s, donc la fenêtre suivante) : encore 22
    // requêtes → deuxième fenêtre épuisée D'AFFILÉE → doit déclencher le
    // blacklist automatique.
    vi.setSystemTime(61_000);
    let last;
    for (let i = 0; i < 22; i++) last = checkPublicChatRateLimit(chatbotId, ip);

    // `.toEqual({...})` compare un objet champ par champ (contrairement à
    // `.toBe`, qui utilise `===` et échouerait toujours sur deux objets
    // différents même avec le même contenu).
    expect(last).toEqual({ allowed: false, blacklisted: true });

    // Une fois blacklistée, l'IP doit être rejetée immédiatement, même sur
    // une toute nouvelle fenêtre (instant 122s) — pas besoin de recompter.
    vi.setSystemTime(122_000);
    expect(checkPublicChatRateLimit(chatbotId, ip)).toEqual({ allowed: false, blacklisted: true });
  });

  it('never blacklists the "unknown" fallback IP', () => {
    // Si on ne connaît pas l'IP réelle du visiteur (pas de proxy devant
    // l'app, cf. getClientIp ci-dessus), il ne faut surtout pas blacklister
    // "unknown" — ça bloquerait TOUT LE MONDE derrière un tel proxy.
    const chatbotId = uniqueKey('bot');
    vi.setSystemTime(0);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, 'unknown');
    vi.setSystemTime(61_000);
    for (let i = 0; i < 22; i++) checkPublicChatRateLimit(chatbotId, 'unknown');

    const result = checkPublicChatRateLimit(chatbotId, 'unknown');
    // `.toBeUndefined()` : le champ `blacklisted` ne doit même pas exister
    // dans la réponse.
    expect(result.blacklisted).toBeUndefined();
  });

  it('does not blacklist a single exhausted window (one-off burst)', () => {
    // Épuiser la fenêtre UNE SEULE fois (un pic ponctuel de trafic, pas un
    // vrai bot qui insiste) ne doit pas suffire à déclencher le blacklist —
    // il faut deux fenêtres D'AFFILÉE (voir le test plus haut).
    const chatbotId = uniqueKey('bot');
    const ip = `198.51.100.${counter + 100}`;

    vi.setSystemTime(0);
    let last;
    for (let i = 0; i < 22; i++) last = checkPublicChatRateLimit(chatbotId, ip);

    // `.toMatchObject({...})` : comme `.toEqual`, mais tolère que l'objet
    // reçu ait d'autres champs en plus — pratique ici car on ne veut
    // vérifier que `allowed`, sans se soucier des autres champs possibles.
    expect(last).toMatchObject({ allowed: false });
    expect((last as { blacklisted?: boolean }).blacklisted).toBeUndefined();
  });
});
