import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatWidget from '@/components/ChatWidget';
import { logQueryError } from '@/lib/supabaseResult';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbotData, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, name, loading_messages')
    .eq('id', params.id)
    .single();
  const chatbot = logQueryError('chat_page.chatbot_failed', { chatbotId: params.id }, chatbotData, chatbotError);

  if (!chatbot) notFound();

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="mb-4">
        <Link
          href={`/dashboard/chatbots/${chatbot.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {chatbot.name}
        </Link>
      </div>
      <ChatWidget chatbotId={chatbot.id} loadingMessages={chatbot.loading_messages ?? undefined} />
    </div>
  );
}
