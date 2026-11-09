import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateContractForm from '@/components/CreateContractForm';
import ChatbotCard from '@/components/ChatbotCard';
import { Badge, Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { ICONS } from '@/components/icons';
import { CONTRACT_ANALYZER_ALLOWED_PLANS } from '@/lib/plans';
import { logQueryError } from '@/lib/supabaseResult';

export default async function ContractsPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const allowed = CONTRACT_ANALYZER_ALLOWED_PLANS.includes(org.plan);

  const supabase = createClient();
  const chatbotsResult = await supabase
    .from('chatbots')
    .select('id, name, created_at')
    .eq('organization_id', org.id)
    .eq('use_case', 'contract_analyzer')
    .order('created_at', { ascending: false });
  const chatbots = logQueryError(
    'contracts_page.chatbots_failed',
    { orgId: org.id },
    chatbotsResult.data,
    chatbotsResult.error
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analyseur de contrats</h1>
            <Badge tone="blue">Premium</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Uploadez un contrat, obtenez un résumé des clauses clés et posez vos questions dessus.
            Chaque contrat est analysé isolément, pas mélangé avec vos autres documents.
          </p>
        </div>
        {allowed && <CreateContractForm organizationId={org.id} />}
      </div>

      {!allowed ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Fonctionnalité réservée aux plans PME et Métier</p>
          <p className="max-w-sm text-sm text-slate-400">
            Passez à un palier supérieur pour analyser vos contrats automatiquement.
          </p>
          <ButtonLink href="/dashboard/plan" size="sm" className="mt-2">
            Changer de plan
          </ButtonLink>
        </Card>
      ) : (chatbots ?? []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Aucun contrat analysé pour l'instant</p>
          <p className="text-sm text-slate-400">Uploadez un contrat pour en obtenir le résumé.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(chatbots ?? []).map((bot) => (
            <ChatbotCard
              key={bot.id}
              id={bot.id}
              name={bot.name}
              createdAt={bot.created_at}
              icon={ICONS.briefcase}
              href={`/dashboard/contrats/${bot.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
