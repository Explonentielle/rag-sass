import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SystemPromptEditor from '@/components/SystemPromptEditor';
import DocumentUploader from '@/components/DocumentUploader';
import UrlUploader from '@/components/UrlUploader';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import DeleteDocumentButton from '@/components/DeleteDocumentButton';
import ViewChunksButton from '@/components/ViewChunksButton';
import ConversationsPanel from '@/components/ConversationsPanel';
import EmbedSettingsForm from '@/components/EmbedSettingsForm';
import DeleteChatbotSection from '@/components/DeleteChatbotSection';
import AiIndexingToggle from '@/components/AiIndexingToggle';
import EmailToolToggle from '@/components/EmailToolToggle';
import VisitorUploadsToggle from '@/components/VisitorUploadsToggle';
import LoadingMessagesForm from '@/components/LoadingMessagesForm';
import { listAllConversationsForChatbot } from '@/lib/conversations';
import { logQueryError } from '@/lib/supabaseResult';
import { AI_INDEXING_ALLOWED_PLANS } from '@/lib/plans';
import { Icon, IconBadge, ICONS } from '@/components/icons';

export default async function ChatbotPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbotData, error: chatbotError } = await supabase
    .from('chatbots')
    .select(
      'id, name, system_prompt_template, organization_id, is_public, allowed_origins, use_documents, use_ai_indexing, allow_email_tool, notification_email, allow_visitor_uploads, show_loading_steps, loading_messages'
    )
    .eq('id', params.id)
    .single();
  const chatbot = logQueryError('chatbot_page.chatbot_failed', { chatbotId: params.id }, chatbotData, chatbotError);

  if (!chatbot) notFound();

  const [documentsResult, customTemplatesResult, orgResult, conversations] = await Promise.all([
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
    // Not necessarily the "current active org" cookie (getCurrentOrg) —
    // this chatbot's own organization_id, in case a multi-org user landed
    // here via a direct link to a chatbot outside their active org.
    supabase.from('organizations').select('plan').eq('id', chatbot.organization_id).single(),
    // listAllConversationsForChatbot throws (and logs) on failure instead
    // of returning a {data,error} pair — it goes through app/dashboard/
    // error.tsx (see roadmap.md item 38), not logQueryError below.
    listAllConversationsForChatbot(supabase, chatbot.id),
  ]);
  const documents = logQueryError(
    'chatbot_page.documents_failed',
    { chatbotId: chatbot.id },
    documentsResult.data,
    documentsResult.error
  );
  const customTemplates = logQueryError(
    'chatbot_page.templates_failed',
    { organizationId: chatbot.organization_id },
    customTemplatesResult.data,
    customTemplatesResult.error
  );
  const org = logQueryError(
    'chatbot_page.organization_failed',
    { organizationId: chatbot.organization_id },
    orgResult.data,
    orgResult.error
  );

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
          initialUseDocuments={chatbot.use_documents}
          customTemplates={customTemplates ?? []}
        />
        <EmailToolToggle
          chatbotId={chatbot.id}
          initialValue={chatbot.allow_email_tool}
          initialEmail={chatbot.notification_email}
        />
        <LoadingMessagesForm
          chatbotId={chatbot.id}
          initialValue={chatbot.loading_messages}
          initialShowSteps={chatbot.show_loading_steps}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.document}</Icon>
            Documents
          </h2>
          <div className="flex flex-wrap items-start gap-3">
            <UrlUploader chatbotId={chatbot.id} />
            <DocumentUploader chatbotId={chatbot.id} />
          </div>
        </div>
        {!chatbot.use_documents && (
          <p className="text-xs text-amber-600">
            Ce chatbot répond uniquement à partir de son prompt (mode "sans documents" activé
            ci-dessus) — les documents ajoutés ici ne seront pas utilisés tant que ce mode est actif.
          </p>
        )}

        <AiIndexingToggle
          chatbotId={chatbot.id}
          initialValue={chatbot.use_ai_indexing}
          allowed={!!org && AI_INDEXING_ALLOWED_PLANS.includes(org.plan)}
        />

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
              <div className="flex items-center gap-3">
                <DocumentStatusBadge status={doc.status} />
                {doc.status === 'indexed' && <ViewChunksButton documentId={doc.id} />}
                <DeleteDocumentButton documentId={doc.id} />
              </div>
            </div>
          ))}
          {(documents ?? []).length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Aucun document pour l'instant.
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.quote}</Icon>
            Conversations
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les conversations de ce chatbot, côté équipe et côté visiteurs
            (widget public). Utile pour retrouver et supprimer la conversation d'un visiteur sur
            demande RGPD.
          </p>
        </div>
        <ConversationsPanel chatbotId={chatbot.id} initialConversations={conversations} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-brand-600">{ICONS.globe}</Icon>
          Widget (accès public, apparence, embed)
        </h2>
        <EmbedSettingsForm
          chatbotId={chatbot.id}
          initialIsPublic={chatbot.is_public}
          initialAllowedOrigins={chatbot.allowed_origins}
        />
        <VisitorUploadsToggle
          chatbotId={chatbot.id}
          initialValue={chatbot.allow_visitor_uploads}
          emailNotificationsReady={chatbot.allow_email_tool && !!chatbot.notification_email}
        />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-red-600">{ICONS.alert}</Icon>
          Zone de danger
        </h2>
        <DeleteChatbotSection chatbotId={chatbot.id} chatbotName={chatbot.name} />
      </section>
    </div>
  );
}
