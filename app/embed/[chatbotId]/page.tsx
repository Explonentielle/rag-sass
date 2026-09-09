import ChatWidget from '@/components/ChatWidget';
import EmbedBubbleWidget from '@/components/EmbedBubbleWidget';

// Loaded inside an <iframe> on a third-party site. No auth, no nav — see
// docs/integration.md. Two modes:
// - default: chrome-free, fills whatever the host page's iframe is sized
//   to — for a client building their own bubble/toggle wrapper.
// - ?widget=1: self-contained bubble+toggle chrome (EmbedBubbleWidget),
//   paired with public/widget.js on the host page, which resizes the
//   iframe itself in response — the "one script tag" integration path.
export default function EmbedPage({
  params,
  searchParams,
}: {
  params: { chatbotId: string };
  searchParams: { widget?: string };
}) {
  if (searchParams.widget === '1') {
    return <EmbedBubbleWidget chatbotId={params.chatbotId} />;
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <ChatWidget
        chatbotId={params.chatbotId}
        apiEndpoint="/api/public-chat"
        className="h-full border-0 shadow-none"
      />
    </div>
  );
}
