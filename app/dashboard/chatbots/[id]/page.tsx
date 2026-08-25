import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SystemPromptEditor from '@/components/SystemPromptEditor';
import DocumentUploader from '@/components/DocumentUploader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import { Icon, IconBadge, ICONS } from '@/components/icons';

export default async function ChatbotPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('id, name, system_prompt_template, organization_id')
    .eq('id', params.id)
    .single();

  if (!chatbot) notFound();

  const [{ data: documents }, { data: customTemplates }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, filename, status, error_message, chunk_count, uploaded_at')
      .eq('chatbot_id', chatbot.id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('custom_templates')
      .select('id, label, template')
      .eq('organization_id', chatbot.organization_id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconBadge spacing="">{ICONS.chat}</IconBadge>
          <div>
            <Link
              href="/dashboard/chatbots"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Chatbots
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {chatbot.name}
            </h1>
          </div>
        </div>
        <ButtonLink href={`/dashboard/chatbots/${chatbot.id}/chat`}>Ouvrir le chat</ButtonLink>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600">{ICONS.settings}</Icon>
          Comportement du chatbot
        </h2>
        <SystemPromptEditor
          chatbotId={chatbot.id}
          organizationId={chatbot.organization_id}
          initialValue={chatbot.system_prompt_template}
          customTemplates={customTemplates ?? []}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.document}</Icon>
            Documents
          </h2>
          <DocumentUploader chatbotId={chatbot.id} />
        </div>

        <Card className="divide-y divide-slate-100">
          {(documents ?? []).map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-5 py-4 text-sm">
              <div>
                <p className="font-medium text-slate-900">{doc.filename}</p>
                {doc.status === 'error' && doc.error_message && (
                  <p className="mt-0.5 text-xs text-red-600">{doc.error_message}</p>
                )}
                {doc.status === 'indexed' && (
                  <p className="mt-0.5 text-xs text-slate-400">{doc.chunk_count} segments indexés</p>
                )}
              </div>
              <DocumentStatusBadge status={doc.status} />
            </div>
          ))}
          {(documents ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Aucun document pour l'instant.
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
