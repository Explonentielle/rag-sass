'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, Input, Label } from '@/components/ui/Card';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import ChatWidget from '@/components/ChatWidget';
import { IconBadge, ICONS } from '@/components/icons';
import type { DocumentStatus } from '@/types/database';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // matches the upload route's maxDuration

// Recap mode (no organizationId, used by ReplayOnboardingButton once a
// chatbot already exists): purely informational, same 4 slides regardless
// of plan. Interactive mode (first-time trigger, see app/dashboard/page.tsx)
// walks through actually creating the first chatbot instead.
const RECAP_STEPS = [
  {
    icon: ICONS.bolt,
    title: 'Bienvenue sur Corpus.ai',
    body: "Transformez vos documents en chatbot IA en quelques clics. Voici les quelques points à connaître pour démarrer.",
  },
  {
    icon: ICONS.chat,
    title: "Deux façons de l'utiliser",
    body: "Chatbots : un widget à embarquer sur votre site pour vos visiteurs. Assistant interne : pour vous ou votre équipe, sur vos propres documents, sans diffusion publique.",
  },
  {
    icon: ICONS.document,
    title: 'Comment démarrer',
    body: "Créez un chatbot, ajoutez vos documents (PDF, site web...), testez-le directement dans le dashboard, puis copiez le code d'intégration pour l'ajouter à votre site.",
  },
  {
    icon: ICONS.settings,
    title: 'Paramètres & facturation',
    body: "Gérez votre équipe, votre palier tarifaire et votre comportement en cas de dépassement de quota depuis Paramètres > Organisation, à tout moment.",
  },
];

const INTERACTIVE_TOTAL_STEPS = 6;

export default function OnboardingTour({
  organizationId,
  onClose,
}: {
  // Présent uniquement au premier déclenchement (0 chatbot), voir
  // app/dashboard/page.tsx, bascule le tuto en mode interactif. Absent
  // pour le replay (ReplayOnboardingButton) : à ce stade l'org a déjà un
  // chatbot, créer "le premier" n'a plus de sens, et retenter l'appel
  // buterait sur l'entitlement cap gratuit/solo (1 chatbot).
  organizationId?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const interactive = !!organizationId;

  // Étape "créer" (interactive uniquement)
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  const [chatbotName, setChatbotName] = useState('');

  // Étape "document" (interactive uniquement)
  const inputRef = useRef<HTMLInputElement>(null);
  const [docFilename, setDocFilename] = useState('');
  const [docStatus, setDocStatus] = useState<'idle' | 'uploading' | DocumentStatus>('idle');
  const [docError, setDocError] = useState<string | null>(null);

  const totalSteps = interactive ? INTERACTIVE_TOTAL_STEPS : RECAP_STEPS.length;
  const isLast = step === totalSteps - 1;
  // Tant que le chatbot n'est pas encore créé, "Suivant" n'a pas de sens :
  // le formulaire de l'étape fait lui-même avancer au succès.
  const isCreatePending = interactive && step === 2 && !chatbotId;

  async function dismiss() {
    setOpen(false);
    onClose?.();
    // Pas de router.refresh() pendant le tuto (voir handleCreate) : seulement
    // ici, à la fermeture, pour que le dashboard reflète le chatbot/document
    // créés sans risquer de démonter le tuto en cours de route.
    router.refresh();
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { onboarding_dismissed: true } });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !organizationId) return;
    setCreating(true);
    setCreateError(null);

    const res = await fetch('/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, name: name.trim(), useCase: 'site_widget' }),
    }).catch(() => null);

    setCreating(false);
    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({}));
      setCreateError(body?.error || 'Erreur lors de la création.');
      return;
    }

    const body = await res.json();
    setChatbotId(body.id);
    setChatbotName(name.trim());
    // Pas de router.refresh() ici : le dashboard derrière la modale montre
    // encore 0 chatbot le temps du tuto, ce qui est sans conséquence (il
    // est masqué par l'overlay), et évite que showOnboarding repasse à
    // false et démonte ce composant en plein milieu de l'étape suivante.
    setStep(step + 1);
  }

  async function pollDocument(documentId: string, deadline: number) {
    const res = await fetch(`/api/documents/${documentId}`).catch(() => null);
    const body = await res?.json().catch(() => null);
    const status: DocumentStatus | undefined = body?.document?.status;
    if (status) setDocStatus(status);

    if (status === 'indexed' || status === 'error') {
      if (status === 'error') setDocError(body?.document?.error_message ?? null);
      return;
    }
    if (Date.now() > deadline) return;
    setTimeout(() => pollDocument(documentId, deadline), POLL_INTERVAL_MS);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file || !chatbotId) return;

    setDocFilename(file.name);
    setDocError(null);
    setDocStatus('uploading');

    const formData = new FormData();
    formData.append('chatbotId', chatbotId);
    formData.append('file', file);

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData }).catch(
      () => null
    );
    if (!res || !res.ok) {
      const body = await res?.json().catch(() => ({}));
      setDocStatus('error');
      setDocError(body?.error || "Échec de l'upload.");
      return;
    }

    const body = await res.json();
    if (body.document?.id) {
      setDocStatus(body.document.status ?? 'pending');
      pollDocument(body.document.id, Date.now() + POLL_TIMEOUT_MS);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-md p-6">
        {!interactive && <RecapStepContent step={step} />}

        {interactive && step === 0 && (
          <InfoStep icon={ICONS.bolt} title="Bienvenue sur Corpus.ai">
            Transformez vos documents en chatbot IA en quelques clics. On va créer votre premier
            chatbot ensemble, ça prend deux minutes.
          </InfoStep>
        )}

        {interactive && step === 1 && (
          <InfoStep icon={ICONS.chat} title="Deux façons de l'utiliser">
            Chatbots : un widget à embarquer sur votre site pour vos visiteurs. Assistant interne :
            pour vous ou votre équipe, sur vos propres documents, sans diffusion publique. On
            démarre avec un chatbot classique, le plus courant.
          </InfoStep>
        )}

        {interactive && step === 2 && (
          <div>
            <IconBadge spacing="mb-4">{ICONS.chat}</IconBadge>
            <h2 className="text-lg font-semibold text-slate-900">Créez votre premier chatbot</h2>
            {chatbotId ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                ✅ « {chatbotName} » est créé. Passons à la suite.
              </p>
            ) : (
              <form onSubmit={handleCreate} className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label>Nom du chatbot</Label>
                  <Input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex. Support client"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                {createError && <p className="text-sm text-red-600">{createError}</p>}
                <Button type="submit" size="sm" disabled={creating || !name.trim()}>
                  {creating ? 'Création...' : 'Créer et continuer'}
                </Button>
              </form>
            )}
          </div>
        )}

        {interactive && step === 3 && (
          <div>
            <IconBadge spacing="mb-4">{ICONS.document}</IconBadge>
            <h2 className="text-lg font-semibold text-slate-900">Ajoutez un document</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Vos visiteurs pourront poser des questions dessus. Étape facultative, vous pourrez en
              ajouter d'autres plus tard depuis la page du chatbot.
            </p>
            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={docStatus === 'uploading'}
              >
                {docStatus === 'uploading' ? 'Envoi...' : '+ Choisir un fichier'}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                disabled={docStatus === 'uploading'}
                className="hidden"
              />
            </div>
            {docFilename && docStatus !== 'idle' && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="truncate text-slate-700">{docFilename}</span>
                {docStatus === 'uploading' ? (
                  <span className="text-xs text-slate-400">Envoi...</span>
                ) : (
                  <DocumentStatusBadge status={docStatus as DocumentStatus} />
                )}
              </div>
            )}
            {docError && <p className="mt-2 text-sm text-red-600">{docError}</p>}
          </div>
        )}

        {interactive && step === 4 && chatbotId && (
          <div>
            <IconBadge spacing="mb-4">{ICONS.chat}</IconBadge>
            <h2 className="text-lg font-semibold text-slate-900">Testez votre chatbot</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Posez-lui une question, comme le feraient vos visiteurs.
            </p>
            <div className="mt-4 flex h-80 flex-col">
              <ChatWidget chatbotId={chatbotId} placeholder="Essayez une question..." />
            </div>
          </div>
        )}

        {interactive && step === 5 && chatbotId && (
          <div>
            <IconBadge spacing="mb-4">{ICONS.globe}</IconBadge>
            <h2 className="text-lg font-semibold text-slate-900">Code d'intégration</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Collez ceci avant <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">&lt;/body&gt;</code> sur
              votre site :
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
{`<script
  src="https://votre-domaine.com/widget.js"
  data-chatbot-id="${chatbotId}"
></script>`}
            </pre>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              D'autres options (couleur, iframe brute...) sont dans Documentation. L'équipe, le
              palier tarifaire et la facturation se gèrent depuis Paramètres &gt; Organisation, à
              tout moment.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Besoin de plus (assistants illimités, indexation IA, membres d'équipe) ?{' '}
              <Link href="/dashboard/plan" className="font-medium text-brand-700 hover:text-brand-800">
                Voir le palier PME →
              </Link>
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-brand-700' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
            Passer
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(step - 1)}>
                Précédent
              </Button>
            )}
            {!isCreatePending &&
              (isLast ? (
                <Button type="button" size="sm" onClick={dismiss}>
                  Terminer
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
                  Suivant
                </Button>
              ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoStep({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <IconBadge spacing="mb-4">{icon}</IconBadge>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

function RecapStepContent({ step }: { step: number }) {
  const current = RECAP_STEPS[step];
  return (
    <InfoStep icon={current.icon} title={current.title}>
      {current.body}
    </InfoStep>
  );
}
