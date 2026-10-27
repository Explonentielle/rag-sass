// Client pour le service OCR interne hébergé sur le VPS (ocr-service/, voir
// docs/roadmap.md item 7) — appelé par lib/extract.ts, soit en fallback
// quand un PDF n'a pas de texte natif extractible, soit directement pour
// une image uploadée telle quelle. Même esprit que lib/elasticsearch.ts :
// un petit client HTTP vers un service auto-hébergé, configuré par
// variables d'environnement.

export class OcrServiceError extends Error {}

// Généreux mais fini : largement sous le plafond de 300s du job
// d'arrière-plan (maxDuration dans app/api/documents/upload/route.ts), pour
// laisser le temps de rasteriser + OCR plusieurs pages sans bloquer
// indéfiniment si le VPS ne répond pas.
const OCR_FETCH_TIMEOUT_MS = 120_000;

/**
 * Envoie le fichier (PDF ou image) au service OCR et renvoie le texte
 * reconnu. Le service détecte lui-même le format réel à partir des octets
 * du fichier (ocr-service/server.js) — aucun Content-Type spécifique à
 * fournir ici.
 *
 * Renvoie `null` si OCR_SERVICE_URL n'est pas configuré (ex. dev local sans
 * le VPS) — l'appelant retombe alors sur le comportement "non supporté"
 * existant plutôt que de planter. Lève `OcrServiceError` si le service est
 * configuré mais échoue (réponse en erreur, timeout, réseau).
 */
export async function runOcr(buffer: Buffer): Promise<string | null> {
  const url = process.env.OCR_SERVICE_URL;
  if (!url) return null;

  const secret = process.env.OCR_SERVICE_SECRET;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${url}/ocr`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      // Buffer itself isn't in fetch's BodyInit type (lib.dom.d.ts doesn't
      // know about Node's Buffer) — a plain Uint8Array view of the same
      // bytes, with no copy, satisfies it.
      body: new Uint8Array(buffer),
    });
  } catch (err) {
    throw new OcrServiceError(
      `Le service OCR est momentanément indisponible : ${err instanceof Error ? err.message : 'erreur réseau'}.`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OcrServiceError(`Le service OCR a répondu avec une erreur (${response.status}).`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? '';
}
