'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Card';
import {
  MAX_BOT_NAME_CHARS,
  MAX_LOGO_BYTES,
  MAX_SUGGESTED_QUESTIONS,
  MAX_SUGGESTED_QUESTION_CHARS,
  MAX_WELCOME_MESSAGE_CHARS,
} from '@/lib/widgetAppearance';

export default function WidgetAppearanceForm({
  chatbotId,
  initialBotName,
  initialWelcomeMessage,
  initialSuggestedQuestions,
  initialLogoUrl,
  brandingShown,
}: {
  chatbotId: string;
  initialBotName: string | null;
  initialWelcomeMessage: string | null;
  initialSuggestedQuestions: string[] | null;
  initialLogoUrl: string | null;
  /** The org's plan shows « Propulsé par Corpus.ai » in the widget. */
  brandingShown: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [botName, setBotName] = useState(initialBotName ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(initialWelcomeMessage ?? '');
  const [questionsText, setQuestionsText] = useState((initialSuggestedQuestions ?? []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  function markDirty() {
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const suggestedQuestions = questionsText
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botName,
        welcomeMessage,
        suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : null,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la sauvegarde.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Le logo dépasse ${MAX_LOGO_BYTES / 1024} Ko.`);
      return;
    }

    setLogoBusy(true);
    setLogoError(null);
    const form = new FormData();
    form.set('file', file);
    const res = await fetch(`/api/chatbots/${chatbotId}/logo`, { method: 'POST', body: form }).catch(() => null);
    setLogoBusy(false);

    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setLogoError(body?.error || "Impossible d'envoyer le logo.");
      return;
    }
    setLogoUrl(body.logoUrl);
    router.refresh();
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    setLogoError(null);
    const res = await fetch(`/api/chatbots/${chatbotId}/logo`, { method: 'DELETE' }).catch(() => null);
    setLogoBusy(false);
    if (!res?.ok) {
      setLogoError('Impossible de retirer le logo.');
      return;
    }
    setLogoUrl(null);
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">Apparence du widget</p>
        <p className="text-xs text-slate-500">
          Ce que voient vos visiteurs : un en-tête avec votre logo et le nom de l&apos;assistant, un message
          d&apos;accueil et des questions à cliquer pour démarrer.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo actuel" className="h-12 w-12 rounded-full border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400">
              Aucun
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoSelected}
            className="hidden"
            tabIndex={-1}
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={logoBusy}>
            {logoBusy ? 'Envoi...' : logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
          </Button>
          {logoUrl && (
            <Button variant="secondary" size="sm" onClick={handleLogoRemove} disabled={logoBusy}>
              Retirer
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400">PNG, JPEG ou WebP, {MAX_LOGO_BYTES / 1024} Ko maximum. Affiché en rond.</p>
        {logoError && <p className="text-xs text-red-600">{logoError}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Nom de l&apos;assistant</Label>
        <Input
          value={botName}
          onChange={(e) => {
            setBotName(e.target.value);
            markDirty();
          }}
          maxLength={MAX_BOT_NAME_CHARS}
          placeholder="Ex. Léa, conseillère Votre Accompagnateur"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Message d&apos;accueil</Label>
        <textarea
          value={welcomeMessage}
          onChange={(e) => {
            setWelcomeMessage(e.target.value);
            markDirty();
          }}
          maxLength={MAX_WELCOME_MESSAGE_CHARS}
          rows={3}
          placeholder="Ex. Bonjour, je réponds à vos questions sur nos accompagnements. Que souhaitez-vous savoir ?"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Questions suggérées (une par ligne)</Label>
        <textarea
          value={questionsText}
          onChange={(e) => {
            setQuestionsText(e.target.value);
            markDirty();
          }}
          rows={4}
          placeholder={'Quels sont vos tarifs ?\nComment prendre rendez-vous ?'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-xs text-slate-400">
          {MAX_SUGGESTED_QUESTIONS} questions maximum, {MAX_SUGGESTED_QUESTION_CHARS} caractères chacune. Affichées
          sous le message d&apos;accueil tant que le visiteur n&apos;a rien demandé.
        </p>
      </div>

      <p className="text-xs text-slate-500">
        {brandingShown
          ? "La mention « Propulsé par Corpus.ai » s'affiche en bas du widget avec votre plan. Elle est retirée à partir du plan PME."
          : 'Votre plan retire la mention « Propulsé par Corpus.ai » du widget.'}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSave} disabled={saving || saved} size="sm">
        {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
      </Button>
    </div>
  );
}
