'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconBadge, ICONS } from '@/components/icons';

// Next.js wraps every page under app/dashboard/** with this boundary — one
// file covers all of them, instead of a try/catch repeated per page. Kicks
// in whenever a Server Component throws while rendering (e.g. lib/org.ts's
// getCurrentOrg, lib/conversations.ts, lib/usage.ts all throw on a genuine
// DB error rather than silently hiding it — see docs/roadmap.md item 38).
// The real error detail never reaches this component in production (Next.js
// redacts it, keeping only `digest`) — it's logged server-side at the throw
// site instead (logError calls next to each `throw` in those files).
export default function DashboardError({
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <IconBadge tone="red" spacing="mx-auto mb-4">
          {ICONS.alert}
        </IconBadge>
        <h1 className="text-lg font-semibold text-slate-900">Une erreur s'est produite</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cette page n'a pas pu s'afficher correctement. Réessayez — si le problème persiste,
          contactez le support avec la référence ci-dessous.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-400">Référence : {error.digest}</p>
        )}
        <Button onClick={() => reset()} className="mt-6">
          Réessayer
        </Button>
      </Card>
    </div>
  );
}
