'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// Renders nothing — mounted by app/dashboard/contrats/[id]/page.tsx only
// while the one document is still 'pending'/'processing', polls its status
// (same pattern as components/DocumentUploader.tsx) and refreshes the
// server page once it's done, which picks up both the new status and
// chatbots.contract_summary (set by lib/ingest.ts before the document
// flips to 'indexed', see processDocument's Promise.all).
export default function ContractStatusPoller({ documentId }: { documentId: string }) {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    async function poll() {
      const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
      const body = await res?.json().catch(() => null);
      const status = body?.document?.status;

      if (status === 'indexed' || status === 'error' || Date.now() > deadline) {
        router.refresh();
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
  }, [documentId, router]);

  return null;
}
