import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import DeleteDocumentButton from '@/components/DeleteDocumentButton';
import { Card } from '@/components/ui/Card';
import { logQueryError } from '@/lib/supabaseResult';
import type { DocumentStatus } from '@/types/database';

export default async function DocumentsPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const { data: documentsData, error: documentsError } = await supabase
    .from('documents')
    .select(
      'id, filename, status, error_message, chunk_count, uploaded_at, chatbot_id, chatbots!inner(id, name, organization_id)'
    )
    .eq('chatbots.organization_id', org.id)
    .order('uploaded_at', { ascending: false });
  const documents = logQueryError(
    'documents_page.documents_failed',
    { orgId: org.id },
    documentsData,
    documentsError
  );

  const allDocuments = documents ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          {allDocuments.length} document{allDocuments.length > 1 ? 's' : ''} sur tous vos chatbots
        </p>
      </div>

      <Card className="divide-y divide-slate-100">
        {allDocuments.map((doc) => {
          const chatbot = Array.isArray(doc.chatbots) ? doc.chatbots[0] : doc.chatbots;
          return (
            <Link
              key={doc.id}
              href={`/dashboard/chatbots/${doc.chatbot_id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{doc.filename}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {chatbot?.name} · {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                  {doc.status === 'indexed' && ` · ${doc.chunk_count} segments`}
                </p>
                {doc.status === 'error' && doc.error_message && (
                  <p className="mt-0.5 text-xs text-red-600">{doc.error_message}</p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <DocumentStatusBadge status={doc.status as DocumentStatus} />
                <DeleteDocumentButton documentId={doc.id} />
              </div>
            </Link>
          );
        })}
        {allDocuments.length === 0 && (
          <div className="px-5 py-16 text-center text-sm text-slate-400">
            Aucun document uploadé pour l'instant. Uploade des documents depuis la page d'un
            chatbot.
          </div>
        )}
      </Card>
    </div>
  );
}
