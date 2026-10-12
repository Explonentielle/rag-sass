import ChatWidget from '@/components/ChatWidget';
import EmbedBubbleWidget from '@/components/EmbedBubbleWidget';
import { getAdminClient } from '@/lib/supabase/admin';

// Only #rgb / #rrggbb / #rrggbbaa — the value flows into inline styles, so
// this keeps it to a harmless CSS color instead of trusting an arbitrary
// query string (no auth on this route, see below).
const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function readAccentColor(color: string | undefined): string | undefined {
  return color && HEX_COLOR_RE.test(color) ? color : undefined;
}

// Loaded inside an <iframe> on a third-party site. No auth, no nav — see
// docs/integration.md. Two modes:
// - default: chrome-free, fills whatever the host page's iframe is sized
//   to — for a client building their own bubble/toggle wrapper.
// - ?widget=1: self-contained bubble+toggle chrome (EmbedBubbleWidget),
//   paired with public/widget.js on the host page, which resizes the
//   iframe itself in response — the "one script tag" integration path.
// ?color=#rrggbb (either mode): pseudo white-label — see public/widget.js's
// data-primary-color and readAccentColor() above.
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: { chatbotId: string };
  searchParams: { widget?: string; color?: string };
}) {
  const accentColor = readAccentColor(searchParams.color);

  // No session on this route (anonymous iframe) — admin client, same as
  // /api/public-chat. Not gated behind the full is_public/allowed_origins
  // check that route does: loading_messages is non-sensitive display text,
  // and real chat access is still enforced there regardless of what loads
  // here. Falls back to defaults (ChatWidget's resolveLoadingMessages) on
  // any failure, including a chatbot that doesn't exist.
  const { data: chatbot } = await getAdminClient()
    .from('chatbots')
    .select('loading_messages')
    .eq('id', params.chatbotId)
    .single();
  const loadingMessages = chatbot?.loading_messages ?? undefined;

  if (searchParams.widget === '1') {
    return (
      <EmbedBubbleWidget
        chatbotId={params.chatbotId}
        accentColor={accentColor}
        loadingMessages={loadingMessages}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <ChatWidget
        chatbotId={params.chatbotId}
        apiEndpoint="/api/public-chat"
        className="h-full border-0 shadow-none"
        accentColor={accentColor}
        loadingMessages={loadingMessages}
      />
    </div>
  );
}
