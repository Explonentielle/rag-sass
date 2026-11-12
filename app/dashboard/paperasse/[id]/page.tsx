import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DocumentUploader from '@/components/DocumentUploader';
import ContractStatusPoller from '@/components/ContractStatusPoller';
import DocumentFieldsList from '@/components/DocumentFieldsList';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import DeleteDocumentButton from '@/components/DeleteDocumentButton';
import DeleteChatbotSection from '@/components/DeleteChatbotSection';
import { Badge, Card } from '@/components/ui/Card';
import { Icon, IconBadge, ICONS } from '@/components/icons';
import { logQueryError } from '@/lib/supabaseResult';
import type { DocumentFormat } from '@/types/database';
import PageSections from '@/components/PageSections';

const FORMAT_LABELS = { facture: 'Facture', libre: 'Libre' } as const;

export default async function DigitizerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: chatbotData, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, name, organization_id, use_case, document_format')
    .eq('id', params.id)
    .single();
  const chatbot = logQueryError('digitizer_page.chatbot_failed', { chatbotId: params.id }, chatbotData, chatbotError);

  if (!chatbot || chatbot.use_case !== 'paperwork_digitizer') notFound();

  // postgrest-js's type inference for a select-string column list doesn't
  // narrow this to DocumentFormat (pre-existing gap, same pattern as
  // app/api/chatbots/route.ts's `plan` annotation): annotate explicitly.
  const documentFormat: DocumentFormat | null = chatbot.document_format;

  const { data: documentsData, error: documentsError } = await supabase
    .from('documents')
    .select('id, filename, status, error_message, chunk_count, extracted_fields, uploaded_at')
    .eq('chatbot_id', chatbot.id)
    .order('uploaded_at', { ascending: false });
  const documents = logQueryError(
    'digitizer_page.documents_failed',
    { chatbotId: chatbot.id },
    documentsData,
    documentsError
  );

  return (
    <div className="space-y-10">
      <PageSections
        sections={[
          { id: 'documents', label: 'Documents' },
          { id: 'danger', label: 'Zone de danger' },
        ]}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconBadge spacing="">{ICONS.layers}</IconBadge>
          <div>
            <Link href="/dashboard/paperasse" className="text-sm text-slate-500 hover:text-slate-700">
              ← Digitaliseur de paperasse
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{chatbot.name}</h1>
              {documentFormat && <Badge tone="blue">{FORMAT_LABELS[documentFormat]}</Badge>}
            </div>
          </div>
        </div>
      </div>

      <section id="documents" className="scroll-mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600">{ICONS.document}</Icon>
            Documents
          </h2>
          <DocumentUploader chatbotId={chatbot.id} />
        </div>

        {(documents ?? []).length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-400">
            Aucun document pour l'instant. Ajoutez-en un pour voir ses champs extraits ici.
          </Card>
        ) : (
          <div className="space-y-4">
            {(documents ?? []).map((doc) => {
              const isProcessing = doc.status === 'pending' || doc.status === 'processing';
              return (
                <Card key={doc.id} className="overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <p className="font-medium text-slate-900">{doc.filename}</p>
                    <div className="flex items-center gap-3">
                      <DocumentStatusBadge status={doc.status} />
                      <DeleteDocumentButton documentId={doc.id} />
                    </div>
                  </div>

                  {isProcessing && <ContractStatusPoller documentId={doc.id} />}

                  {doc.status === 'error' && (
                    <p className="px-5 pb-4 text-sm text-red-600">
                      {doc.error_message || 'Erreur inconnue lors du traitement.'}
                    </p>
                  )}

                  {doc.status === 'indexed' &&
                    (doc.extracted_fields ? (
                      <div className="border-t border-slate-100">
                        <DocumentFieldsList fields={doc.extracted_fields} />
                      </div>
                    ) : (
                      <p className="px-5 pb-4 text-sm text-slate-400">
                        Les champs n'ont pas pu être extraits de ce document.
                      </p>
                    ))}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section id="danger" className="scroll-mt-6 space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-red-600">{ICONS.alert}</Icon>
          Zone de danger
        </h2>
        <DeleteChatbotSection chatbotId={chatbot.id} chatbotName={chatbot.name} redirectHref="/dashboard/paperasse" />
      </section>
    </div>
  );
}
