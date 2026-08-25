import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatWidget from '@/components/ChatWidget';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, name')
    .eq('id', params.id)
    .single();

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
      <ChatWidget chatbotId={chatbot.id} />
    </div>
  );
}
