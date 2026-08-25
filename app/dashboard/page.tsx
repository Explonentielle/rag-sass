import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateOrgForm from '@/components/CreateOrgForm';
import CreateChatbotForm from '@/components/CreateChatbotForm';
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge';
import { Card } from '@/components/ui/Card';
import { IconBadge, ICONS } from '@/components/icons';
import { PROMPT_TEMPLATES } from '@/lib/prompts';
import type { DocumentStatus } from '@/types/database';

export default async function DashboardPage() {
  const org = await getCurrentOrg();

  if (!org) {
    return <CreateOrgForm />;
  }

  const supabase = createClient();

  const [{ data: chatbots }, { data: documents }, { data: customTemplates }] = await Promise.all([
    supabase
      .from('chatbots')
      .select('id, name, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, filename, status, chunk_count, uploaded_at, chatbot_id, chatbots!inner(id, name, organization_id)')
      .eq('chatbots.organization_id', org.id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('custom_templates')
      .select('id, label, template')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
  ]);

  const allDocuments = documents ?? [];
  const recentChatbots = (chatbots ?? []).slice(0, 4);
  const recentDocuments = allDocuments.slice(0, 5);
  const stats = {
    chatbots: chatbots?.length ?? 0,
    documents: allDocuments.length,
    indexed: allDocuments.filter((d) => d.status === 'indexed').length,
    inProgress: allDocuments.filter((d) => d.status === 'pending' || d.status === 'processing')
      .length,
    errors: allDocuments.filter((d) => d.status === 'error').length,
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Vue d'ensemble de votre espace</p>
        </div>
        <CreateChatbotForm organizationId={org.id} customTemplates={customTemplates ?? []} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ICONS.chat} tone="brand" label="Chatbots" value={stats.chatbots} />
        <StatCard
          icon={ICONS.checkCircle}
          tone="green"
          label="Documents indexés"
          value={stats.indexed}
        />
        <StatCard icon={ICONS.upload} tone="amber" label="En traitement" value={stats.inProgress} />
        <StatCard icon={ICONS.alert} tone="red" label="Erreurs" value={stats.errors} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Chatbots récents</h2>
          <Link href="/dashboard/chatbots" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Voir tous →
          </Link>
        </div>
        {recentChatbots.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
            <p className="text-sm font-medium text-slate-600">Aucun chatbot pour l'instant</p>
            <p className="text-sm text-slate-400">Créez votre premier chatbot pour commencer.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentChatbots.map((bot) => (
              <Link key={bot.id} href={`/dashboard/chatbots/${bot.id}`} className="block">
                <Card className="p-5 transition-shadow hover:shadow-md">
                  <IconBadge size="sm" spacing="mb-3">
                    {ICONS.chat}
                  </IconBadge>
                  <p className="font-medium text-slate-900">{bot.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(bot.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Documents récents</h2>
          <Link href="/dashboard/documents" className="text-sm font-medium text-brand-700 hover:text-brand-800">
            Voir tous →
          </Link>
        </div>
        <Card className="divide-y divide-slate-100">
          {recentDocuments.map((doc) => {
            const chatbot = Array.isArray(doc.chatbots) ? doc.chatbots[0] : doc.chatbots;
            return (
              <Link
                key={doc.id}
                href={`/dashboard/chatbots/${doc.chatbot_id}`}
                className="flex items-center justify-between px-5 py-4 text-sm hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{doc.filename}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {chatbot?.name} · {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <DocumentStatusBadge status={doc.status as DocumentStatus} />
              </Link>
            );
          })}
          {recentDocuments.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              Aucun document uploadé pour l'instant.
            </div>
          )}
        </Card>
      </section>

      <Link href="/dashboard/templates" className="block">
        <Card className="flex items-center justify-between p-6 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-4">
            <IconBadge spacing="mb-0" tone="brand">
              {ICONS.layers}
            </IconBadge>
            <div>
              <p className="font-semibold text-slate-900">
                {PROMPT_TEMPLATES.length + (customTemplates?.length ?? 0)} templates disponibles
              </p>
              <p className="text-sm text-slate-500">
                Vente, support client, immobilier, secrétariat médical...
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-brand-700">Explorer →</span>
        </Card>
      </Link>
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: 'brand' | 'green' | 'amber' | 'red';
  label: string;
  value: number;
}) {
  return (
    <Card className="p-5">
      <IconBadge tone={tone} size="sm" spacing="mb-3">
        {icon}
      </IconBadge>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}
