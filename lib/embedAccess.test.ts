// Tests pour lib/embedAccess.ts — le contrôle d'origine pour l'embed public
// (restriction de domaine : quels sites ont le droit d'intégrer un
// chatbot donné via l'iframe/widget).

import { describe, it, expect } from 'vitest';
import { getRequestOrigin, isOriginAllowed, normalizeOrigin } from './embedAccess';

describe('getRequestOrigin', () => {
  it('prefers the Origin header', () => {
    // Le navigateur envoie normalement un en-tête "Origin" sur les requêtes
    // fetch/XHR cross-site — c'est la source la plus fiable.
    const req = new Request('http://api.test', {
      headers: { origin: 'https://client-site.com', referer: 'https://other.com/page' },
    });
    expect(getRequestOrigin(req)).toBe('https://client-site.com');
  });

  it('falls back to the Referer header origin when Origin is missing', () => {
    // Certaines navigations n'envoient pas d'Origin — on se rabat alors sur
    // Referer, en n'en gardant que l'origine (schéma + domaine + port),
    // pas le chemin complet de la page.
    const req = new Request('http://api.test', {
      headers: { referer: 'https://client-site.com/some/page?x=1' },
    });
    expect(getRequestOrigin(req)).toBe('https://client-site.com');
  });

  it('returns null when neither header is present', () => {
    const req = new Request('http://api.test');
    expect(getRequestOrigin(req)).toBeNull();
  });

  it('returns null for an unparseable Referer', () => {
    // Un Referer qui n'est pas une URL valide ne doit pas faire planter la
    // fonction — juste renvoyer null proprement.
    const req = new Request('http://api.test', { headers: { referer: 'not a url' } });
    expect(getRequestOrigin(req)).toBeNull();
  });
});

describe('isOriginAllowed', () => {
  it('allows any origin when the allowlist is empty (opt-in model)', () => {
    // Modèle "opt-in" : tant qu'un chatbot n'a AUCUN domaine explicitement
    // autorisé, il reste ouvert à tous — c'est en ajoutant un domaine à la
    // liste qu'on active la restriction (évite de casser les embeds
    // existants sans prévenir).
    expect(isOriginAllowed('https://anything.com', [])).toBe(true);
    expect(isOriginAllowed(null, [])).toBe(true);
  });

  it('allows an origin present in the allowlist', () => {
    expect(isOriginAllowed('https://client-site.com', ['https://client-site.com'])).toBe(true);
  });

  it('rejects an origin not in a non-empty allowlist', () => {
    expect(isOriginAllowed('https://evil.com', ['https://client-site.com'])).toBe(false);
  });

  it('rejects a null origin once an allowlist is set', () => {
    // Dès qu'une restriction existe, une requête SANS origine identifiable
    // (ni Origin ni Referer exploitable) doit être refusée par prudence.
    expect(isOriginAllowed(null, ['https://client-site.com'])).toBe(false);
  });
});

describe('normalizeOrigin', () => {
  it('strips path, query, and trailing slash down to scheme://host[:port]', () => {
    // Un utilisateur qui colle une URL complète (avec chemin, paramètres...)
    // dans le formulaire de réglages doit quand même matcher correctement —
    // on ne garde que scheme://host[:port], exactement ce que contient
    // l'en-tête Origin envoyé par le navigateur.
    expect(normalizeOrigin('https://client-site.com/some/page?x=1')).toBe('https://client-site.com');
    expect(normalizeOrigin('https://client-site.com:8080/')).toBe('https://client-site.com:8080');
  });

  it('trims whitespace from pasted input', () => {
    expect(normalizeOrigin('  https://client-site.com  ')).toBe('https://client-site.com');
  });

  it('returns null for input that is not an absolute URL', () => {
    expect(normalizeOrigin('client-site.com')).toBeNull(); // pas de "https://" → pas une URL absolue
    expect(normalizeOrigin('')).toBeNull();
  });
});
