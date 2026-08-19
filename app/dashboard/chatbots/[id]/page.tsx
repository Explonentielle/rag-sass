import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SystemPromptEditor from '@/components/SystemPromptEditor';
import DocumentUploader from '@/components/DocumentUploader';

export default async function ChatbotPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, name, system_prompt_template')
    .eq('id', params.id)
    .single();

  if (!chatbot) notFound();

  const { data: documents } = await supabase
    .from('documents')
    .select('id, filename, status, error_message, chunk_count, uploaded_at')
    .eq('chatbot_id', chatbot.id)
    .order('uploaded_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold">{chatbot.name}</h1>
        </div>
        <Link
          href={`/dashboard/chatbots/${chatbot.id}/chat`}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Ouvrir le chat
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Comportement du chatbot</h2>
        <SystemPromptEditor chatbotId={chatbot.id} initialValue={chatbot.system_prompt_template} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Documents</h2>
        <DocumentUploader chatbotId={chatbot.id} />

        <ul className="divide-y rounded-lg border bg-white">
          {(documents ?? []).map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{doc.filename}</p>
                {doc.status === 'error' && doc.error_message && (
                  <p className="text-xs text-red-600">{doc.error_message}</p>
                )}
                {doc.status === 'indexed' && (
                  <p className="text-xs text-gray-500">{doc.chunk_count} segments indexés</p>
                )}
              </div>
              <StatusBadge status={doc.status} />
            </li>
          ))}
          {(documents ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-gray-500">Aucun document pour l'instant.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    processing: 'bg-blue-100 text-blue-700',
    indexed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    pending: 'En attente',
    processing: 'Traitement...',
    indexed: 'Indexé',
    error: 'Erreur',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
