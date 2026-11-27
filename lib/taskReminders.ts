import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { sendEmail } from '@/lib/email';
import { logInfo, logWarn } from '@/lib/logger';

interface OverdueTask {
  title: string;
  dueDate: string;
  chatbotName: string;
}

function formatDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildReminderEmail(tasks: OverdueTask[]): string {
  const lines = tasks.map((t) => `- ${t.title} (${t.chatbotName}), échéance dépassée le ${formatDate(t.dueDate)}`);
  return `Les tâches suivantes sont en retard et pas encore marquées faites :\n\n${lines.join('\n')}\n\nÀ consulter dans le dashboard, page "Tâches".`;
}

/**
 * Envoie un rappel par email aux admins/owners de chaque organisation ayant
 * au moins une tâche en retard et non faite (docs/roadmap.md item 73).
 * Un seul email par admin, groupant toutes ses tâches en retard, plutôt
 * qu'un email par tâche. WhatsApp explicitement écarté (voir item 73).
 */
export async function sendOverdueTaskReminders(
  admin: SupabaseClient<Database>
): Promise<{ organizationsNotified: number; emailsSent: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue, error } = await admin
    .from('tasks')
    .select('title, due_date, chatbots!inner(name, organization_id)')
    .eq('status', 'pending')
    .lt('due_date', today);

  if (error) {
    logWarn('task_reminders.query_failed', { error: error.message });
    return { organizationsNotified: 0, emailsSent: 0 };
  }

  const tasksByOrg = new Map<string, OverdueTask[]>();
  for (const row of overdue ?? []) {
    const chatbot = Array.isArray(row.chatbots) ? row.chatbots[0] : row.chatbots;
    if (!chatbot || !row.due_date) continue;
    const list = tasksByOrg.get(chatbot.organization_id) ?? [];
    list.push({ title: row.title, dueDate: row.due_date, chatbotName: chatbot.name });
    tasksByOrg.set(chatbot.organization_id, list);
  }

  let emailsSent = 0;
  for (const [organizationId, orgTasks] of tasksByOrg) {
    const { data: admins, error: adminsError } = await admin
      .from('users_organizations')
      .select('user_id')
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'admin']);

    if (adminsError || !admins) {
      logWarn('task_reminders.admins_query_failed', { organizationId, error: adminsError?.message });
      continue;
    }

    const body = buildReminderEmail(orgTasks);
    for (const { user_id } of admins) {
      const { data: userData } = await admin.auth.admin.getUserById(user_id);
      const email = userData.user?.email;
      if (!email) continue;

      try {
        await sendEmail({ to: email, subject: `${orgTasks.length} tâche(s) en retard`, body });
        emailsSent += 1;
      } catch (err) {
        logWarn('task_reminders.send_failed', {
          organizationId,
          userId: user_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logInfo('task_reminders.done', { organizationsNotified: tasksByOrg.size, emailsSent });
  return { organizationsNotified: tasksByOrg.size, emailsSent };
}
