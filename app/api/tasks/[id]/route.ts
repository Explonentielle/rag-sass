import { NextResponse } from 'next/server';
import { reportDbError } from '@/lib/reportError';
import { createClient } from '@/lib/supabase/server';
import { logInfo } from '@/lib/logger';

// Bascule une tâche entre 'pending' et 'done' (docs/roadmap.md item 72).
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== 'pending' && status !== 'done') {
    return NextResponse.json({ error: "status doit être 'pending' ou 'done'." }, { status: 400 });
  }

  // RLS (tasks_update: scopée via chatbots.organization_id) impose le
  // tenant : un id d'une autre org ne sera simplement pas trouvé.
  const { data: task, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', params.id)
    .select('id')
    .single();

  if (error) {
    const { message } = reportDbError('task.update_failed', error, { taskId: params.id });
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (!task) {
    return NextResponse.json({ error: 'Tâche introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { error } = await supabase.from('tasks').delete().eq('id', params.id);
  if (error) {
    const { message } = reportDbError('task.delete_failed', error, { taskId: params.id });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  logInfo('task.deleted', { taskId: params.id });
  return NextResponse.json({ ok: true });
}
