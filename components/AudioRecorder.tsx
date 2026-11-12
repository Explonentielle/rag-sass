'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  uploadDocumentFile,
  pollDocumentUntilDone,
  DOCUMENT_POLL_TIMEOUT_MS,
} from '@/lib/clientDocumentUpload';

// Débit fixé explicitement (plutôt que le défaut du navigateur, variable) :
// assez pour de la voix, et prévisible pour tenir sous la limite de 24 Mo de
// lib/extract.ts (MAX_AUDIO_BYTES) sur tout l'intervalle ci-dessous.
const AUDIO_BITS_PER_SECOND = 32_000;
const MAX_RECORDING_MS = 90 * 60 * 1000;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

// Enregistre une réunion depuis le navigateur et l'envoie à la route
// d'upload générique comme n'importe quel document (docs/roadmap.md item
// 46) : transcrite (lib/openai.ts transcribeAudio) puis indexée normalement
// — à côté de components/DocumentUploader.tsx et components/UrlUploader.tsx,
// une troisième façon de nourrir le RAG.
export default function AudioRecorder({ chatbotId, allowed }: { chatbotId: string; allowed: boolean }) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function handleStart() {
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accès au micro refusé ou indisponible. Vérifiez les autorisations du navigateur.");
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => handleStop(recorder.mimeType || mimeType || 'audio/webm');

    mediaRecorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setElapsedMs(0);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORDING_MS) handleRequestStop();
    }, 1000);
  }

  function handleRequestStop() {
    mediaRecorderRef.current?.stop();
    stopStream();
    setRecording(false);
  }

  async function handleStop(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) return;

    setUploading(true);
    const ext = extensionForMimeType(mimeType);
    const name = `Réunion ${new Date().toLocaleString('fr-FR').replace(/[/:]/g, '-')}.${ext}`;
    const file = new File([blob], name, { type: mimeType });

    const result = await uploadDocumentFile(chatbotId, file);
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    pollDocumentUntilDone(result.documentId, Date.now() + DOCUMENT_POLL_TIMEOUT_MS, () => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {!allowed && <Badge tone="blue">Premium</Badge>}
        {recording ? (
          <>
            <span className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              {formatElapsed(elapsedMs)}
            </span>
            <Button variant="secondary" size="sm" onClick={handleRequestStop}>
              Arrêter et transcrire
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleStart} disabled={!allowed || uploading}>
            {uploading ? 'Envoi en cours...' : '+ Enregistrer une réunion'}
          </Button>
        )}
      </div>
      {!allowed && (
        <p className="max-w-xs text-right text-xs text-amber-600">
          Nécessite le plan PME ou Métier.
        </p>
      )}
      <p className="text-xs text-slate-400">90 min max, transcrite puis indexée automatiquement.</p>
      {error && <p className="max-w-xs text-right text-sm text-red-600">{error}</p>}
    </div>
  );
}
