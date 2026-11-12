import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateDigitizerForm from '@/components/CreateDigitizerForm';
import ChatbotCard from '@/components/ChatbotCard';
import { Badge, Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { ICONS } from '@/components/icons';
import { PAPERWORK_DIGITIZER_ALLOWED_PLANS } from '@/lib/plans';
import { logQueryError } from '@/lib/supabaseResult';

export default async function PaperasseListPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const allowed = PAPERWORK_DIGITIZER_ALLOWED_PLANS.includes(org.plan);

  const supabase = createClient();
  const chatbotsResult = await supabase
    .from('chatbots')
    .select('id, name, created_at')
    .eq('organization_id', org.id)
    .eq('use_case', 'paperwork_digitizer')
    .order('created_at', { ascending: false });
  const chatbots = logQueryError(
    'paperasse_page.chatbots_failed',
    { orgId: org.id },
    chatbotsResult.data,
    chatbotsResult.error
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Digitaliseur de paperasse</h1>
            <Badge tone="blue">Premium</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Uploadez vos factures ou documents administratifs au fil du temps, obtenez les champs clés
            extraits automatiquement de chacun.
          </p>
        </div>
        {allowed && <CreateDigitizerForm organizationId={org.id} />}
      </div>

      {!allowed ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Fonctionnalité réservée aux plans PME et Métier</p>
          <p className="max-w-sm text-sm text-slate-400">
            Passez à un palier supérieur pour digitaliser vos documents automatiquement.
          </p>
          <ButtonLink href="/dashboard/plan" size="sm" className="mt-2">
            Changer de plan
          </ButtonLink>
        </Card>
      ) : (chatbots ?? []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Aucun digitaliseur pour l'instant</p>
          <p className="text-sm text-slate-400">Créez-en un pour commencer à y accumuler des documents.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(chatbots ?? []).map((bot) => (
            <ChatbotCard
              key={bot.id}
              id={bot.id}
              name={bot.name}
              createdAt={bot.created_at}
              icon={ICONS.layers}
              href={`/dashboard/paperasse/${bot.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
