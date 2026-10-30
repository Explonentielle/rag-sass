'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconBadge, ICONS } from '@/components/icons';

const STEPS = [
  {
    icon: ICONS.bolt,
    title: 'Bienvenue sur Corpus.ai',
    body: "Transformez vos documents en chatbot IA en quelques clics. Voici les quelques points à connaître pour démarrer.",
  },
  {
    icon: ICONS.chat,
    title: 'Deux façons de l\'utiliser',
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

export default function OnboardingTour({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  async function dismiss() {
    setOpen(false);
    onClose?.();
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { onboarding_dismissed: true } });
  }

  if (!open) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="w-full max-w-md p-6">
        <IconBadge spacing="mb-4">{current.icon}</IconBadge>
        <h2 className="text-lg font-semibold text-slate-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.body}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
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
            {isLast ? (
              <Button type="button" size="sm" onClick={dismiss}>
                Terminer
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
                Suivant
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
