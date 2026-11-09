'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { IconBadge, ICONS } from '@/components/icons';

// Plain next/link prefetches this page in the background as soon as the
// card scrolls into view, so by the time it's clicked the navigation is
// often instant — too fast for app/dashboard/loading.tsx to ever actually
// flash, which left clicks feeling unresponsive even though nothing was
// wrong. useTransition's pending state covers the click itself (including
// the brief moment even a prefetched navigation still takes to commit),
// so this spinner shows precisely as long as the click is doing something,
// never longer and never not at all.
export default function ChatbotCard({
  id,
  name,
  createdAt,
  icon = ICONS.chat,
  href,
}: {
  id: string;
  name: string;
  createdAt: string;
  icon?: React.ReactNode;
  // Defaults to the shared chatbot detail route — every use_case except
  // 'contract_analyzer' (app/dashboard/contrats/page.tsx) is viewed there.
  href?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.push(href ?? `/dashboard/chatbots/${id}`))}
      className="block w-full text-left"
    >
      <Card className="relative p-5 transition-shadow hover:shadow-md">
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700"
              role="status"
              aria-label="Chargement"
            />
          </div>
        )}
        <IconBadge size="sm" spacing="mb-3">
          {icon}
        </IconBadge>
        <p className="truncate font-medium text-slate-900" title={name}>
          {name}
        </p>
        <p className="mt-1 text-xs text-slate-400">Créé le {new Date(createdAt).toLocaleDateString('fr-FR')}</p>
      </Card>
    </button>
  );
}
