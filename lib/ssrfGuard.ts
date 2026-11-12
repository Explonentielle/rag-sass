import { isIP } from 'node:net';
import dns from 'node:dns/promises';

// Garde SSRF partagée par l'ingestion d'URL (lib/extract.ts) et les webhooks
// sortants (lib/leadWebhook.ts). Module volontairement minuscule : les routes
// de chat l'importent, elles ne doivent pas embarquer jsdom ou pdf-parse.

export class BlockedAddressError extends Error {}

/**
 * Refuse qu'un fetch serveur parte vers une adresse privée, interne ou
 * réservée, quel que soit le demandeur : la requête part de notre serveur
 * (sur un VPS, éventuellement à côté d'autres services internes), donc un
 * compte malveillant ou compromis pourrait sinon s'en servir pour sonder le
 * réseau interne. Limite connue : le nom d'hôte est vérifié *avant* le fetch,
 * une réponse DNS qui change entre la vérification et la connexion (DNS
 * rebinding) n'est pas détectée (docs/roadmap.md item 44).
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  if (hostname === 'localhost') {
    throw new BlockedAddressError('Cette URL pointe vers une adresse locale, non autorisée.');
  }

  const addresses = isIP(hostname)
    ? [hostname]
    : (await dns.lookup(hostname, { all: true }).catch(() => [])).map((a) => a.address);

  if (addresses.length === 0) {
    throw new BlockedAddressError("Cette adresse n'a pas pu être résolue.");
  }

  for (const address of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new BlockedAddressError('Cette URL pointe vers une adresse réseau privée, non autorisée.');
    }
  }
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, includes cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local, fc00::/7
  if (lower.startsWith('fe80')) return true; // link-local
  return false;
}
