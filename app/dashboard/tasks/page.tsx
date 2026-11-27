import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import { Card } from '@/components/ui/Card';
import TaskRow from '@/components/TaskRow';
import { logQueryError } from '@/lib/supabaseResult';

export default async function TasksPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const { data: tasksData, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, created_at, chatbot_id, chatbots!inner(id, name, organization_id)')
    .eq('chatbots.organization_id', org.id)
    .order('due_date', { ascending: true, nullsFirst: false });
  const tasks = logQueryError('tasks_page.tasks_failed', { orgId: org.id }, tasksData, tasksError) ?? [];

  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tâches</h1>
        <p className="mt-1 text-sm text-slate-500">
          Extraites automatiquement des enregistrements audio de vos assistants internes
          (docs/roadmap.md item 72).
        </p>
      </div>

      <Card className="divide-y divide-slate-100">
        {pending.map((t) => {
          const chatbot = Array.isArray(t.chatbots) ? t.chatbots[0] : t.chatbots;
          return (
            <TaskRow
              key={t.id}
              id={t.id}
              title={t.title}
              dueDate={t.due_date}
              status={t.status}
              chatbotName={chatbot?.name ?? ''}
            />
          );
        })}
        {pending.length === 0 && (
          <div className="px-5 py-16 text-center text-sm text-slate-400">
            Aucune tâche en attente. Enregistrez une réunion sur un assistant interne pour en
            extraire automatiquement.
          </div>
        )}
      </Card>

      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            {done.length} tâche{done.length > 1 ? 's' : ''} terminée{done.length > 1 ? 's' : ''}
          </summary>
          <Card className="mt-3 divide-y divide-slate-100">
            {done.map((t) => {
              const chatbot = Array.isArray(t.chatbots) ? t.chatbots[0] : t.chatbots;
              return (
                <TaskRow
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  dueDate={t.due_date}
                  status={t.status}
                  chatbotName={chatbot?.name ?? ''}
                />
              );
            })}
          </Card>
        </details>
      )}
    </div>
  );
}
