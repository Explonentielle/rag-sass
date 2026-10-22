// Tests pour lib/siteLinks.ts — la partie sans réseau du "scan de tout le
// site" (item 50 du roadmap) : lire les liens d'une page ou d'un sitemap, et
// ne garder que les pages du même site.

import { describe, it, expect } from 'vitest';
import { extractHrefs, extractSitemapLocs, normalizePageUrl, toSameSitePageUrl } from './siteLinks';

const base = new URL('https://www.exemple.fr/');

describe('extractHrefs', () => {
  it('reads double-quoted, single-quoted and unquoted href attributes', () => {
    const html = `<a href="/contact">C</a><a class="x" href='/partenaires'>P</a><a href=/faq>F</a>`;
    expect(extractHrefs(html)).toEqual(['/contact', '/partenaires', '/faq']);
  });

  it('decodes HTML entities in the URL', () => {
    expect(extractHrefs('<a href="/page?a=1&amp;b=2">x</a>')).toEqual(['/page?a=1&b=2']);
  });

  it('ignores href on non-anchor tags (e.g. <link> stylesheets)', () => {
    expect(extractHrefs('<link rel="stylesheet" href="/style.css"><a href="/ok">ok</a>')).toEqual(['/ok']);
  });
});

describe('extractSitemapLocs', () => {
  it('reads plain and CDATA <loc> entries', () => {
    const xml = `<urlset><url><loc>https://www.exemple.fr/</loc></url>
      <url><loc><![CDATA[https://www.exemple.fr/contact]]></loc></url></urlset>`;
    expect(extractSitemapLocs(xml)).toEqual(['https://www.exemple.fr/', 'https://www.exemple.fr/contact']);
  });
});

describe('normalizePageUrl', () => {
  it('drops fragment, query string and trailing slash, keeps the root slash', () => {
    expect(normalizePageUrl(new URL('https://www.exemple.fr/contact/?utm_source=x#form'))).toBe(
      'https://www.exemple.fr/contact'
    );
    expect(normalizePageUrl(new URL('https://www.exemple.fr'))).toBe('https://www.exemple.fr/');
  });
});

describe('toSameSitePageUrl', () => {
  it('resolves relative links against the page they were found on', () => {
    expect(toSameSitePageUrl('/partenaires', base)).toBe('https://www.exemple.fr/partenaires');
    expect(toSameSitePageUrl('equipe', new URL('https://www.exemple.fr/a-propos/'))).toBe(
      'https://www.exemple.fr/a-propos/equipe'
    );
  });

  it('treats www and the bare domain as the same site', () => {
    expect(toSameSitePageUrl('https://exemple.fr/contact', base)).toBe('https://exemple.fr/contact');
  });

  it('rejects other domains, including look-alike subdomains of another site', () => {
    expect(toSameSitePageUrl('https://autre-site.fr/', base)).toBeNull();
    expect(toSameSitePageUrl('https://exemple.fr.pirate.com/', base)).toBeNull();
  });

  it('rejects non-page links: mailto, tel, javascript, files and framework assets', () => {
    for (const href of [
      'mailto:contact@exemple.fr',
      'tel:+33600000000',
      'javascript:void(0)',
      '/docs/plaquette.pdf',
      '/images/photo.JPG',
      '/_next/static/chunk.js',
      '/api/contact',
    ]) {
      expect(toSameSitePageUrl(href, base)).toBeNull();
    }
  });

  it('maps an in-page anchor back to the page itself', () => {
    expect(toSameSitePageUrl('#faq', base)).toBe('https://www.exemple.fr/');
  });
});
