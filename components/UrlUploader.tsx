'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Card';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

interface DiscoveredPage {
  url: string;
  alreadyAdded: boolean;
}

function displayPath(url: string): string {
  try {
    const { pathname } = new URL(url);
    return pathname === '/' ? '/ (accueil)' : pathname;
  } catch {
    return url;
  }
}

// Sibling to DocumentUploader.tsx, for URL ingestion (docs/roadmap.md item
// 18, point 5) instead of a file upload — same polling pattern, separate
// component because the input shape (one URL) and request (JSON, not
// multipart) differ enough to not share much code. "Tout le site" (item 50)
// first lists the site's pages, then adds each selected page as its own
// document through the same single-URL endpoint.
export default function UrlUploader({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [wholeSite, setWholeSite] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<DiscoveredPage[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function pollUntilDone(documentId: string, deadline: number) {
    const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    const status = body?.document?.status;

    if (status === 'indexed' || status === 'error') {
      router.refresh();
      return;
    }
    if (Date.now() > deadline) {
      router.refresh();
      return;
    }
    setTimeout(() => pollUntilDone(documentId, deadline), POLL_INTERVAL_MS);
  }

  /** Returns an error message, or null on success. */
  async function addOneUrl(pageUrl: string): Promise<string | null> {
    const res = await fetch('/api/documents/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId, url: pageUrl }),
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      return body?.error || "Échec de l'ajout.";
    }
    const body = await res.json().catch(() => null);
    if (body?.document?.id) {
      pollUntilDone(body.document.id, Date.now() + POLL_TIMEOUT_MS);
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setSubmitting(true);
    setError(null);

    if (!wholeSite) {
      const addError = await addOneUrl(url.trim());
      setSubmitting(false);
      if (addError) {
        setError(addError);
        return;
      }
      setUrl('');
      router.refresh();
      return;
    }

    const res = await fetch('/api/documents/discover-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatbotId, url: url.trim() }),
    }).catch(() => null);
    setSubmitting(false);

    const body = await res?.json().catch(() => null);
    if (!res?.ok || !Array.isArray(body?.pages)) {
      setError(body?.error || 'Impossible de parcourir ce site.');
      return;
    }
    const discovered: DiscoveredPage[] = body.pages;
    setPages(discovered);
    setSelected(new Set(discovered.filter((p) => !p.alreadyAdded).map((p) => p.url)));
  }

  function toggle(pageUrl: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageUrl)) next.delete(pageUrl);
      else next.add(pageUrl);
      return next;
    });
  }

  async function handleAddSelected() {
    const toAdd = (pages ?? []).map((p) => p.url).filter((u) => selected.has(u));
    if (toAdd.length === 0) return;

    setError(null);
    setProgress({ done: 0, total: toAdd.length });
    const failures: string[] = [];

    // One at a time: each request returns as soon as the document row exists
    // (indexing continues in the background), so this stays quick without
    // firing N ingestions at the server at once.
    for (const [i, pageUrl] of toAdd.entries()) {
      const addError = await addOneUrl(pageUrl);
      if (addError) failures.push(`${displayPath(pageUrl)} : ${addError}`);
      setProgress({ done: i + 1, total: toAdd.length });
    }

    setProgress(null);
    setPages(null);
    setSelected(new Set());
    setUrl('');
    router.refresh();
    if (failures.length > 0) {
      setError(`${failures.length} page(s) non ajoutée(s) — ${failures.join(' · ')}`);
    }
  }

  function handleCancel() {
    setPages(null);
    setSelected(new Set());
  }

  const busy = submitting || progress !== null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://exemple.com/page"
          disabled={busy || pages !== null}
          className="w-56 min-w-0"
        />
        <label className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-slate-600">
          <input
            type="checkbox"
            checked={wholeSite}
            disabled={busy || pages !== null}
            onChange={(e) => setWholeSite(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
          />
          Tout le site
        </label>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={busy || pages !== null || !url.trim()}
          className="flex-shrink-0 whitespace-nowrap"
        >
          {submitting ? (wholeSite ? 'Recherche des pages...' : 'Ajout...') : '+ Ajouter une URL'}
        </Button>
      </form>

      {pages !== null && (
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm">
          <p className="text-sm font-medium text-slate-900">
            {pages.length} page{pages.length > 1 ? 's' : ''} trouvée{pages.length > 1 ? 's' : ''}
          </p>
          <p className="mb-2 text-xs text-slate-500">
            Décochez celles à ne pas ajouter. Chaque page devient un document séparé.
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {pages.map((page) => (
              <li key={page.url}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selected.has(page.url)}
                    disabled={progress !== null}
                    onChange={() => toggle(page.url)}
                    className="h-3.5 w-3.5 flex-shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                  />
                  <span className="min-w-0 truncate" title={page.url}>
                    {displayPath(page.url)}
                  </span>
                  {page.alreadyAdded && (
                    <span className="flex-shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      déjà ajoutée
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCancel} disabled={progress !== null}>
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleAddSelected} disabled={progress !== null || selected.size === 0}>
              {progress
                ? `Ajout ${progress.done}/${progress.total}...`
                : `Ajouter ${selected.size} page${selected.size > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="max-w-md text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
