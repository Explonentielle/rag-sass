'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import ChatWidget from '@/components/ChatWidget';
import { Icon, ICONS } from '@/components/icons';

/**
 * Floating support widget, shown site-wide (landing + app) when
 * NEXT_PUBLIC_SUPPORT_CHATBOT_ID is configured. Points at the public,
 * unauthenticated /api/public-chat endpoint — see docs/integration.md.
 */
export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const chatbotId = process.env.NEXT_PUBLIC_SUPPORT_CHATBOT_ID;

  // The /embed/[chatbotId] page IS a chat widget — don't stack a second
  // floating one on top of it.
  if (!chatbotId || pathname?.startsWith('/embed')) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 h-[28rem] w-80 sm:w-96">
          <ChatWidget
            chatbotId={chatbotId}
            apiEndpoint="/api/public-chat"
            placeholder="Une question sur Corpus.ai ?"
            className="h-full rounded-xl border border-slate-200 shadow-2xl"
          />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg transition-transform hover:scale-105"
      >
        <Icon className="h-5 w-5">{open ? ICONS.close : ICONS.chat}</Icon>
      </button>
    </div>
  );
}
