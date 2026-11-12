'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge, Input } from '@/components/ui/Card';

export default function LeadWebhookForm({
  chatbotId,
  initialUrl,
  initialSecret,
  allowed,
}: {
  chatbotId: string;
  initialUrl: string | null;
  initialSecret: string | null;
  /** The org's plan includes the webhook (lib/plans.ts LEAD_WEBHOOK_ALLOWED_PLANS) —
   * re-checked server-side on save, this only controls what the form looks like. */
  allowed: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? '');
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [secret, setSecret] = useState(initialSecret);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function patch(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      return { ok: false, error: body?.error || 'Erreur lors de la sauvegarde.' };
    }
    return { ok: true };
  }

  // The secret is generated server-side and only readable from the saved
  // row, so after a change the page is refreshed to fetch it.
  async function handleSave() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    const result = await patch({ leadWebhookUrl: url.trim() === '' ? null : url.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? null);
      return;
    }
    setSavedUrl(url.trim() === '' ? null : url.trim());
    if (url.trim() === '') setSecret(null);
    router.refresh();
  }

  async function handleRegenerate() {
    if (!window.confirm('Générer un nouveau secret ? L’ancien cessera de fonctionner immédiatement.')) return;
    setBusy(true);
    setError(null);
    const result = await patch({ regenerateWebhookSecret: true });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? null);
      return;
    }
    router.refresh();
  }

  async function handleTest() {
    setBusy(true);
    setTestResult(null);
    const res = await fetch(`/api/chatbots/${chatbotId}/webhook-test`, { method: 'POST' }).catch(() => null);
    setBusy(false);
    const body = await res?.json().catch(() => ({}));
    if (body?.ok) {
      setTestResult({ ok: true, text: `Test reçu (réponse ${body.status}).` });
    } else {
      setTestResult({ ok: false, text: body?.error || 'Le test a échoué.' });
    }
  }

  async function handleCopy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the secret stays visible and selectable.
    }
  }

  const dirty = (savedUrl ?? '') !== url.trim();

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
          Webhook « nouveau lead »
          <Badge tone="blue">PME</Badge>
        </p>
        <p className="text-xs text-slate-500">
          À chaque lead qualifié ou demande de rappel d&apos;un visiteur, le chatbot envoie un message JSON signé à
          cette adresse : de quoi alimenter un CRM, Zapier ou Make. S&apos;ajoute à l&apos;email de notification, qui
          doit rester renseigné. Les tests faits depuis le dashboard n&apos;envoient rien.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          disabled={!allowed || busy}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="min-w-[16rem] flex-1"
        />
        <Button size="sm" onClick={handleSave} disabled={!allowed || busy || !dirty}>
          {busy ? '...' : 'Enregistrer'}
        </Button>
      </div>

      {!allowed && (
        <p className="text-xs text-amber-600">Nécessite le plan PME ou Métier (Paramètres → Organisation).</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {savedUrl && secret && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-medium text-slate-700">Secret de signature</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800">
              {secret}
            </code>
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? 'Copié' : 'Copier'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={busy}>
              Régénérer
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Chaque envoi porte l&apos;en-tête <code>X-Corpus-Signature</code> : <code>sha256=</code> suivi du HMAC-SHA256
            de <code>timestamp.corps</code> (le timestamp est dans <code>X-Corpus-Timestamp</code>) calculé avec ce
            secret. Détail et exemple dans docs/integration.md.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={busy}>
              Envoyer un test
            </Button>
            {testResult && (
              <span className={`text-xs ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>{testResult.text}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
