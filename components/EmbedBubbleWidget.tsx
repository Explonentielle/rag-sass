'use client';

import { useEffect, useState } from 'react';
import ChatWidget from '@/components/ChatWidget';
import { Icon, ICONS } from '@/components/icons';

/**
 * Self-contained bubble+toggle chrome for the iframe embed (see
 * public/widget.js and docs/integration.md). Unlike FloatingChatWidget
 * (used on Corpus.ai's own pages, positioned by our own CSS), this one
 * lives *inside* the iframe and has no way to draw itself over the host
 * page — instead it tells the parent window whether it's open via
 * postMessage, and public/widget.js resizes/repositions the iframe
 * element itself in response. The two pieces only agree on message shape
 * ({ source: 'corpus-widget', open: boolean }) and on sizing staying in
 * sync with public/widget.js's CLOSED/OPEN dimensions (72px / 380x580).
 */
export default function EmbedBubbleWidget({
  chatbotId,
  accentColor,
}: {
  chatbotId: string;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.parent.postMessage({ source: 'corpus-widget', open }, '*');
  }, [open]);

  // app/globals.css sets a global `body { @apply bg-slate-50 }` for every
  // page. Fine for a normal page, but this iframe gets clipped to a circle
  // (closed) or a rounded panel (open) by public/widget.js — anywhere
  // inside that shape not covered by the button/panel needs to be
  // see-through to the host page behind it, not a slate-colored box.
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  return (
    <div className="flex h-screen flex-col justify-end bg-transparent p-3">
      {open && (
        <div className="mb-3 min-h-0 flex-1">
          <ChatWidget
            chatbotId={chatbotId}
            apiEndpoint="/api/public-chat"
            placeholder="Posez votre question..."
            className="h-full rounded-xl border border-slate-200 shadow-2xl"
            accentColor={accentColor}
          />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
        style={accentColor ? { backgroundColor: accentColor } : undefined}
        className={`ml-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 ${
          accentColor ? '' : 'bg-brand-800'
        }`}
      >
        <Icon className="h-5 w-5">{open ? ICONS.close : ICONS.chat}</Icon>
      </button>
    </div>
  );
}
