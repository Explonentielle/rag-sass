import ChatWidget from '@/components/ChatWidget';

// Minimal, chrome-free page designed to be loaded inside an <iframe> on a
// third-party site. No auth, no nav — see docs/integration.md.
export default function EmbedPage({ params }: { params: { chatbotId: string } }) {
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
