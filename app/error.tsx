'use client';

import { useEffect } from 'react';

// Root-level fallback for every route NOT already covered by a more
// specific boundary (app/dashboard/error.tsx handles the dashboard).
// Deliberately minimal/self-contained (no component imports) — this also
// catches errors on /embed/[chatbotId], which can be loaded in a small
// iframe on a third-party site, so it needs to render reasonably at any size.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-slate-900">Une erreur s'est produite.</p>
      {error.digest && <p className="font-mono text-xs text-slate-400">Référence : {error.digest}</p>}
      <button
        onClick={() => reset()}
        className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
      >
        Réessayer
      </button>
    </div>
  );
}
