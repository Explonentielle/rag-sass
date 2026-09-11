'use client';

import { useEffect } from 'react';

// Last-resort fallback — only triggers if app/layout.tsx itself throws
// (app/error.tsx and app/dashboard/error.tsx can't catch that, since they
// render *inside* the root layout). Must define its own <html>/<body>: it
// replaces the root layout entirely when active, so nothing from
// app/layout.tsx (fonts, FloatingChatWidget) is available here.
export default function GlobalError({
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
    <html lang="fr">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 500 }}>Une erreur s'est produite.</p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>
              Référence : {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 6,
              background: '#1F5C46',
              color: 'white',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
