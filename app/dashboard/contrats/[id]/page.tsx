import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatWidget from '@/components/ChatWidget';
import DeleteChatbotSection from '@/components/DeleteChatbotSection';
import ContractStatusPoller from '@/components/ContractStatusPoller';
import ContractSummaryAccordion from '@/components/ContractSummaryAccordion';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import { Card } from '@/components/ui/Card';
import { Icon, IconBadge, ICONS } from '@/components/icons';
import { logQueryError } from '@/lib/supabaseResult';
import PageSections from '@/components/PageSections';

export default async function ContractPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbotData, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, name, organization_id, use_case, contract_summary')
    .eq('id', params.id)
    .single();
  const chatbot = logQueryError('contract_page.chatbot_failed', { chatbotId: params.id }, chatbotData, chatbotError);

  if (!chatbot || chatbot.use_case !== 'contract_analyzer') notFound();

  const { data: documentData, error: documentError } = await supabase
    .from('documents')
    .select('id, filename, status, error_message, chunk_count')
    .eq('chatbot_id', chatbot.id)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const document = logQueryError(
    'contract_page.document_failed',
    { chatbotId: chatbot.id },
    documentData,
    documentError
  );

  const summary = chatbot.contract_summary;
  const isProcessing = document && (document.status === 'pending' || document.status === 'processing');
  const isReady = document?.status === 'indexed';

  // Sidebar sub-menu (docs/roadmap.md item 66). The summary and the chat only
  // exist once the contract is indexed; before that the page has nothing worth
  // a menu of its own.
  const pageSections = isReady
    ? [
        { id: 'resume', label: 'Résumé des clauses' },
        { id: 'question', label: 'Poser une question' },
        { id: 'danger', label: 'Zone de danger' },
      ]
    : [];

  return (
    <div className="space-y-10">
      <PageSections sections={pageSections} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconBadge spacing="">{ICONS.briefcase}</IconBadge>
          <div>
            <Link href="/dashboard/contrats" className="text-sm text-slate-500 hover:text-slate-700">
              ← Analyseur de contrats
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{chatbot.name}</h1>
          </div>
        </div>
        {document && <DocumentStatusBadge status={document.status} />}
      </div>

      {!document && (
        <Card className="p-6 text-sm text-slate-500">Aucun document pour cette analyse.</Card>
      )}

      {isProcessing && document && (
        <Card className="flex items-center gap-3 p-6">
          <div
            className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-brand-700"
            role="status"
            aria-label="Chargement"
          />
          <p className="text-sm text-slate-600">
            Analyse en cours : extraction du contenu, puis résumé des clauses clés. Ça prend
            généralement moins d'une minute.
          </p>
          <ContractStatusPoller documentId={document.id} />
        </Card>
      )}

      {document?.status === 'error' && (
        <Card className="border-red-200 p-6">
          <p className="text-sm font-medium text-slate-900">Échec de l'analyse</p>
          <p className="mt-1 text-sm text-red-600">
            {document.error_message || 'Erreur inconnue lors du traitement.'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Supprimez cette analyse ci-dessous et recommencez avec un autre fichier.
          </p>
        </Card>
      )}

      {isReady && (
        <section id="resume" className="scroll-mt-6 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.document}</Icon>
            Résumé des clauses clés
          </h2>
          {summary ? (
            <Card className="overflow-hidden">
              <ContractSummaryAccordion summary={summary} />
            </Card>
          ) : (
            <Card className="p-6 text-sm text-slate-500">
              Le résumé n'a pas pu être généré pour ce document. Vous pouvez tout de même poser vos
              questions directement dans le chat ci-dessous.
            </Card>
          )}
        </section>
      )}

      {isReady && (
        <section id="question" className="scroll-mt-6 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.chat}</Icon>
            Poser une question sur ce contrat
          </h2>
          <div className="flex h-[32rem] flex-col">
            <ChatWidget chatbotId={chatbot.id} />
          </div>
        </section>
      )}

      <section id="danger" className="scroll-mt-6 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-red-600">{ICONS.alert}</Icon>
          Zone de danger
        </h2>
        <DeleteChatbotSection
          chatbotId={chatbot.id}
          chatbotName={chatbot.name}
          redirectHref="/dashboard/contrats"
        />
      </section>
    </div>
  );
}
