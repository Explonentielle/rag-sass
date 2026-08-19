import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import CreateOrgForm from '@/components/CreateOrgForm';
import CreateChatbotForm from '@/components/CreateChatbotForm';

export default async function DashboardPage() {
  const org = await getCurrentOrg();

  if (!org) {
    return <CreateOrgForm />;
  }

  const supabase = createClient();
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('id, name, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{org.name}</h1>
        <p className="text-sm text-gray-600">Tes chatbots</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(chatbots ?? []).map((bot) => (
          <Link
            key={bot.id}
            href={`/dashboard/chatbots/${bot.id}`}
            className="rounded-lg border bg-white p-4 shadow-sm hover:border-gray-400"
          >
            <p className="font-medium">{bot.name}</p>
            <p className="text-xs text-gray-500">
              Créé le {new Date(bot.created_at).toLocaleDateString('fr-FR')}
            </p>
          </Link>
        ))}

        {(chatbots ?? []).length === 0 && (
          <p className="text-sm text-gray-500">Aucun chatbot pour l'instant.</p>
        )}
      </div>

      <CreateChatbotForm organizationId={org.id} />
    </div>
  );
}
