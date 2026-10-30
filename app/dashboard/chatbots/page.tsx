import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateChatbotForm from '@/components/CreateChatbotForm';
import { Card } from '@/components/ui/Card';
import ChatbotCard from '@/components/ChatbotCard';
import { logQueryError } from '@/lib/supabaseResult';
import { notFound } from 'next/navigation';

export default async function ChatbotsPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const [chatbotsResult, customTemplatesResult] = await Promise.all([
    supabase
      .from('chatbots')
      .select('id, name, created_at')
      .eq('organization_id', org.id)
      .eq('use_case', 'site_widget')
      .order('created_at', { ascending: false }),
    supabase
      .from('custom_templates')
      .select('id, label, template')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
  ]);
  const chatbots = logQueryError(
    'chatbots_page.chatbots_failed',
    { orgId: org.id },
    chatbotsResult.data,
    chatbotsResult.error
  );
  const customTemplates = logQueryError(
    'chatbots_page.templates_failed',
    { orgId: org.id },
    customTemplatesResult.data,
    customTemplatesResult.error
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Chatbots</h1>
          <p className="mt-1 text-sm text-slate-500">
            {(chatbots ?? []).length} chatbot{(chatbots ?? []).length > 1 ? 's' : ''} à embarquer
            sur un site, dans {org.name}
          </p>
        </div>
        <CreateChatbotForm
          organizationId={org.id}
          customTemplates={customTemplates ?? []}
          useCase="site_widget"
        />
      </div>

      {(chatbots ?? []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-16 text-center">
          <p className="text-sm font-medium text-slate-600">Aucun chatbot pour l'instant</p>
          <p className="text-sm text-slate-400">Créez votre premier chatbot pour commencer.</p>
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
