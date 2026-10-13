'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Input } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function EmailToolToggle({
  chatbotId,
  initialValue,
  initialEmail,
}: {
  chatbotId: string;
  initialValue: boolean;
  initialEmail: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [email, setEmail] = useState(initialEmail ?? '');
  const [savedEmail, setSavedEmail] = useState(initialEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la mise à jour.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleToggle(checked: boolean) {
    if (await patch({ allowEmailTool: checked })) setValue(checked);
  }

  async function handleSaveEmail() {
    if (await patch({ notificationEmail: email })) setSavedEmail(email.trim());
  }

  const emailDirty = email.trim() !== savedEmail;

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={value}
          disabled={saving}
          onChange={(e) => handleToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-50"
        />
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="block text-sm font-medium text-slate-900">
              Autoriser l'envoi d'un email sur demande
            </span>
            <Badge tone="blue">Agentique</Badge>
          </span>
          <span className="block text-xs text-slate-500">
            Permet au chatbot d'envoyer un email quand l'interlocuteur le demande explicitement,
            ou fait une demande qui peut nécessiter un suivi par email (être recontacté, recevoir
            des infos...) dans le widget public comme dans le chat du dashboard. Le chatbot
            demande toujours confirmation avant d'envoyer.
          </span>
        </span>
      </div>

      <div className="pl-7">
        <label htmlFor={`notification-email-${chatbotId}`} className="text-xs font-medium text-slate-700">
          Adresse qui reçoit les notifications
        </label>
        <div className="mt-1 flex gap-2">
          <Input
            id={`notification-email-${chatbotId}`}
            type="email"
            value={email}
            disabled={saving}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
          />
          <Button type="button" onClick={handleSaveEmail} disabled={saving || !emailDirty}>
            Enregistrer
          </Button>
        </div>
        {value && !savedEmail && (
          <p className="mt-1 text-xs text-amber-600">
            Sans adresse enregistrée, le chatbot n&apos;enverra aucune notification.
          </p>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
