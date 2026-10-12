'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_FILES_PER_CONVERSATION, MAX_VISITOR_FILE_BYTES } from '@/lib/visitorFileRules';

export default function VisitorUploadsToggle({
  chatbotId,
  initialValue,
  emailNotificationsReady,
}: {
  chatbotId: string;
  initialValue: boolean;
  /** Email tool on and an address saved — files are then attached to the
   * notification email. Only used to word the helper text accurately. */
  emailNotificationsReady: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(checked: boolean) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/chatbots/${chatbotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowVisitorUploads: checked }),
    });

    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors de la mise à jour.');
      return;
    }
    setValue(checked);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <input
        type="checkbox"
        checked={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 disabled:opacity-50"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">
          Autoriser les visiteurs à envoyer des fichiers dans le chat
        </span>
        <span className="block text-xs text-slate-500">
          Un bouton d&apos;envoi apparaît dans le widget. Les fichiers sont enregistrés avec la
          conversation ({MAX_VISITOR_FILE_BYTES / (1024 * 1024)} Mo maximum, {MAX_FILES_PER_CONVERSATION}{' '}
          par conversation) et téléchargeables depuis la liste des conversations. Le chatbot ne les lit
          pas.{' '}
          {emailNotificationsReady
            ? "Ils sont joints à l'email de notification quand un visiteur demande à être recontacté."
            : "Activez la notification par email ci-dessus pour qu'ils soient aussi joints à l'email envoyé quand un visiteur demande à être recontacté."}
        </span>
        {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      </span>
    </div>
  );
}
