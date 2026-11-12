// Upload + polling partagés entre components/DocumentUploader.tsx (fichiers
// choisis via le picker) et components/AudioRecorder.tsx (enregistrement du
// dashboard, docs/roadmap.md item 46) — les deux envoient un `File` à la même
// route /api/documents/upload puis attendent que l'ingestion en arrière-plan
// passe à 'indexed'/'error' de la même façon.

export const DOCUMENT_POLL_INTERVAL_MS = 2000;
export const DOCUMENT_POLL_TIMEOUT_MS = 5 * 60 * 1000; // matches the upload route's maxDuration

export type UploadDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

/** Envoie un fichier à la route d'upload générique pour ce chatbot. */
export async function uploadDocumentFile(chatbotId: string, file: File): Promise<UploadDocumentResult> {
  const formData = new FormData();
  formData.append('chatbotId', chatbotId);
  formData.append('file', file);

  const res = await fetch('/api/documents/upload', { method: 'POST', body: formData }).catch(() => null);

  if (!res || !res.ok) {
    const body = await res?.json().catch(() => ({}));
    return { ok: false, error: body?.error || "Échec de l'upload." };
  }

  const body = await res.json();
  return { ok: true, documentId: body.document?.id };
}

/**
 * Interroge le statut d'un document jusqu'à 'indexed'/'error' (ou expiration
 * du délai), puis appelle `onDone` — l'ingestion tourne en arrière-plan côté
 * serveur (voir app/api/documents/upload/route.ts), ce polling est ce qui
 * permet au dashboard de refléter le résultat sans action de l'utilisateur.
 */
export function pollDocumentUntilDone(documentId: string, deadline: number, onDone: () => void): void {
  fetch(`/api/documents/${documentId}`)
    .then((res) => res.json())
    .catch(() => null)
    .then((body) => {
      const status = body?.document?.status;
      if (status === 'indexed' || status === 'error' || Date.now() > deadline) {
        onDone();
        return;
      }
      setTimeout(() => pollDocumentUntilDone(documentId, deadline, onDone), DOCUMENT_POLL_INTERVAL_MS);
    });
}
