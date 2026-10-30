import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateChatbotForm from '@/components/CreateChatbotForm';
import { Card } from '@/components/ui/Card';
import ChatbotCard from '@/components/ChatbotCard';
import { logQueryError } from '@/lib/supabaseResult';
import { notFound } from 'next/navigation';

export default async function SecondCerveauPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const [chatbotsResult, customTemplatesResult] = await Promise.all([
    supabase
      .from('chatbots')
      .select('id, name, created_at')
      .eq('organization_id', org.id)
      .eq('use_case', 'second_cerveau')
      .order('created_at', { ascending: false }),
    supabase
      .from('custom_templates')
      .select('id, label, template')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
  ]);
  const chatbots = logQueryError(
    'second_cerveau_page.chatbots_failed',
    { orgId: org.id },
    chatbotsResult.data,
    chatbotsResult.error
  );
  const customTemplates = logQueryError(
    'second_cerveau_page.templates_failed',
    { orgId: org.id },
    customTemplatesResult.data,
    customTemplatesResult.error
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Assistant interne</h1>
          <p className="mt-1 text-sm text-slate-500">
            Usage interne : interroger vos propres documents, pas de diffusion publique. {(chatbots ?? []).length}{' '}
            assistant{(chatbots ?? []).length > 1 ? 's' : ''} interne{(chatbots ?? []).length > 1 ? 's' : ''} dans{' '}
            {org.name}
          </p>
        </div>
        <CreateChatbotForm
          organizationId={org.id}
          customTemplates={customTemplates ?? []}
          useCase="second_cerveau"
        />
      </div>

      {(chatbots ?? []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Aucun assistant interne pour l'instant</p>
          <p className="text-sm text-slate-400">
            Créez-en un pour centraliser et interroger vos propres documents.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(chatbots ?? []).map((bot) => (
            <ChatbotCard key={bot.id} id={bot.id} name={bot.name} createdAt={bot.created_at} />
          ))}
        </div>
      )}
    </div>
  );
}
