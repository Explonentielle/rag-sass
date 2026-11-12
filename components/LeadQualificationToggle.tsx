'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Input } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function LeadQualificationToggle({
  chatbotId,
  initialValue,
  initialCriteria,
  initialMeetingLink,
  notificationEmailSet,
}: {
  chatbotId: string;
  initialValue: boolean;
  initialCriteria: string | null;
  initialMeetingLink: string | null;
  /** Lead qualification routes through the same `notification_email` field
   * as the email tool (components/EmailToolToggle.tsx) — only used to word
   * the helper text accurately. */
  notificationEmailSet: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [criteria, setCriteria] = useState(initialCriteria ?? '');
  const [savedCriteria, setSavedCriteria] = useState(initialCriteria ?? '');
  const [meetingLink, setMeetingLink] = useState(initialMeetingLink ?? '');
  const [savedMeetingLink, setSavedMeetingLink] = useState(initialMeetingLink ?? '');
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
    if (await patch({ allowLeadQualification: checked })) setValue(checked);
  }

  async function handleSaveCriteria() {
    if (await patch({ leadQualificationCriteria: criteria })) setSavedCriteria(criteria.trim());
  }

  async function handleSaveMeetingLink() {
    if (await patch({ meetingLink })) setSavedMeetingLink(meetingLink.trim());
  }

  const criteriaDirty = criteria.trim() !== savedCriteria;
  const meetingLinkDirty = meetingLink.trim() !== savedMeetingLink;

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
              Qualifier les leads
            </span>
            <Badge tone="blue">Agentique</Badge>
          </span>
          <span className="block text-xs text-slate-500">
            Le chatbot pose activement quelques questions de qualification, puis note le lead
            (chaud/tiède/froid) et notifie le propriétaire par email, sans attendre que
            l&apos;interlocuteur le demande.
          </span>
        </span>
      </div>

      <div className="space-y-3 pl-7">
        <div>
          <label htmlFor={`lead-criteria-${chatbotId}`} className="text-xs font-medium text-slate-700">
            Critères de qualification (optionnel)
          </label>
          <textarea
            id={`lead-criteria-${chatbotId}`}
            value={criteria}
            disabled={saving}
            onChange={(e) => setCriteria(e.target.value)}
            rows={2}
            placeholder="Ex. budget mini 5000€, zone Île-de-France uniquement, disponibilité sous 1 mois..."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Laissé vide, le chatbot qualifie sur des critères génériques (besoin, budget, délai).
            </p>
            <Button type="button" onClick={handleSaveCriteria} disabled={saving || !criteriaDirty}>
              Enregistrer
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor={`meeting-link-${chatbotId}`} className="text-xs font-medium text-slate-700">
            Lien de prise de rendez-vous (optionnel)
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Le chatbot le propose au visiteur quand son projet est concret et qu&apos;il semble prêt à avancer
            (lead « chaud »). Calendly, Cal.com, une page de contact : toute adresse web convient.
          </p>
          <div className="mt-1 flex gap-2">
            <Input
              id={`meeting-link-${chatbotId}`}
              type="url"
              value={meetingLink}
              disabled={saving}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://calendly.com/..."
            />
            <Button type="button" onClick={handleSaveMeetingLink} disabled={saving || !meetingLinkDirty}>
              Enregistrer
            </Button>
          </div>
        </div>

        {value && !notificationEmailSet && (
          <p className="text-xs text-amber-600">
            Sans adresse de notification enregistrée ci-dessus (section email), le chatbot ne
            pourra notifier aucun lead qualifié.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
