'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';

interface Chunk {
  content: string;
  chunkIndex: number;
}

// Lets someone inspect what ingestion actually indexed for a document
// (docs/roadmap.md item 45) — especially useful with AI-assisted indexing
// (item 18), whose output isn't deterministic and is worth double-checking
// what the model actually produced. Fetched lazily on click, not preloaded
// with the document list — most documents are never inspected.
export default function ViewChunksButton({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    if (chunks !== null) return; // already fetched, don't refetch on reopen
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/documents/${documentId}/chunks`);
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors du chargement.');
      return;
    }
    const body = await res.json();
    setChunks(body.chunks);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        Voir le contenu indexé
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
        >
          <Card
            className="flex max-h-[80vh] w-full max-w-2xl flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Contenu indexé</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-slate-400 hover:text-slate-700"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
              {loading && <p className="text-sm text-slate-400">Chargement...</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {chunks?.length === 0 && (
                <p className="text-sm text-slate-400">Aucun chunk trouvé pour ce document.</p>
              )}
              {chunks?.map((chunk) => (
                <div key={chunk.chunkIndex} className="rounded-md border border-slate-200 p-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Segment {chunk.chunkIndex + 1}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
