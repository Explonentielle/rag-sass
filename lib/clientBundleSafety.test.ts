import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// Un composant du navigateur ('use client') ne doit jamais atteindre, même de
// loin, un module qui lit le système de fichiers ou utilise une API serveur :
// le build de production échoue ("UnhandledSchemeError: node:fs/promises").
// C'est arrivé quand lib/userErrors.ts a importé lib/logger.ts : TypeScript et
// les tests unitaires n'y voient rien, seul le build Vercel le détecte.
// Ce test suit les imports '@/...' de chaque composant client, de proche en
// proche, et refuse les modules serveur.

const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_MODULES = [
  /from\s+['"]node:/, // node:fs, node:path, node:dns...
  /from\s+['"](fs|path|child_process|dns|net)(\/promises)?['"]/,
  /from\s+['"]@\/lib\/logger['"]/,
  /from\s+['"]@\/lib\/supabase\/(admin|server)['"]/,
  /from\s+['"]next\/headers['"]/,
];

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function resolveAlias(spec: string): string | null {
  const base = path.join(ROOT, spec.replace(/^@\//, ''));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// Imports that are erased at build time (`import type`) never reach the bundle.
function runtimeImports(source: string): string[] {
  const specs: string[] = [];
  const re = /^\s*import\s+(?!type\b)[^;]*?from\s+['"](@\/[^'"]+)['"]/gm;
  for (let match = re.exec(source); match; match = re.exec(source)) specs.push(match[1]);
  return specs;
}

function findViolations(entry: string): string[] {
  const violations: string[] = [];
  const seen = new Set<string>();

  function visit(file: string, chain: string[]) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, 'utf-8');
    for (const pattern of FORBIDDEN_MODULES) {
      if (pattern.test(source)) {
        violations.push(`${[...chain, path.relative(ROOT, file)].join(' -> ')} (${pattern})`);
      }
    }
    for (const spec of runtimeImports(source)) {
      const resolved = resolveAlias(spec);
      if (resolved) visit(resolved, [...chain, path.relative(ROOT, file)]);
    }
  }

  visit(entry, []);
  return violations;
}

describe('composants du navigateur', () => {
  const clientFiles = [...listFiles(path.join(ROOT, 'app')), ...listFiles(path.join(ROOT, 'components'))].filter((f) =>
    /^\s*['"]use client['"]/.test(readFileSync(f, 'utf-8'))
  );

  it('trouve bien des composants client à vérifier', () => {
    expect(clientFiles.length).toBeGreaterThan(10);
  });

  it("n'importent aucun module serveur, même indirectement", () => {
    const all = clientFiles.flatMap(findViolations);
    expect(all).toEqual([]);
  });
});
