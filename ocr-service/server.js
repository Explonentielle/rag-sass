// Service interne OCR pour le VPS (docs/roadmap.md item 7) — appelé par
// lib/ocrService.ts quand un PDF n'a pas de texte natif extractible. Pas de
// dépendance npm : module `http` natif, binaires système (`pdftoppm` du
// paquet poppler-utils, `tesseract`) installés dans le Dockerfile.
//
// Jamais exposé directement sur Internet : seul Caddy (TLS) l'est, ce
// conteneur n'écoute que sur le réseau Docker interne (voir
// docker-compose.prod.yml, pattern identique à Elasticsearch).

const http = require('node:http');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = 8080;
const SECRET = process.env.OCR_SERVICE_SECRET;

// Bornes volontairement généreuses mais finies : protègent le petit
// conteneur d'un fichier pathologique (PDF énorme ou avec des milliers de
// pages) qui monopoliserait le CPU/la mémoire pour une seule requête.
const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 Mo
const MAX_PAGES = 50;
const RENDER_DPI = 200;

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error(`Fichier trop volumineux (max ${MAX_BODY_BYTES / 1024 / 1024} Mo).`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Rasterise chaque page du PDF en PNG (pdftoppm), OCR chaque page (tesseract,
 * français + anglais), renvoie le texte concaténé et le nombre de pages. */
async function ocrPdfBuffer(pdfBuffer) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ocr-'));
  try {
    const pdfPath = path.join(workDir, 'input.pdf');
    await fs.writeFile(pdfPath, pdfBuffer);

    const pagePrefix = path.join(workDir, 'page');
    await execFileAsync('pdftoppm', ['-png', '-r', String(RENDER_DPI), pdfPath, pagePrefix]);

    const files = (await fs.readdir(workDir))
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort();

    if (files.length === 0) {
      throw new Error('Aucune page rasterisée depuis ce PDF.');
    }
    if (files.length > MAX_PAGES) {
      throw new Error(`Trop de pages (${files.length}, max ${MAX_PAGES}).`);
    }

    const pageTexts = [];
    for (const file of files) {
      const imagePath = path.join(workDir, file);
      const text = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'fra+eng']);
      pageTexts.push(text.trim());
    }

    return { text: pageTexts.join('\n\n'), pageCount: files.length };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorized(req) {
  if (!SECRET) return true; // pas de secret configuré : pas de vérification (dev uniquement)
  const header = req.headers['authorization'] || '';
  const expected = `Bearer ${SECRET}`;
  return header.length === expected.length && timingSafeEqual(header, expected);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/ocr') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (!isAuthorized(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  try {
    const pdfBuffer = await readBody(req);
    if (pdfBuffer.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Corps de requête vide.' }));
      return;
    }

    const { text, pageCount } = await ocrPdfBuffer(pdfBuffer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text, pageCount }));
  } catch (err) {
    console.error('ocr.failed', err instanceof Error ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur OCR inconnue.' }));
  }
});

server.listen(PORT, () => {
  console.log(`ocr-service listening on :${PORT}`);
});
