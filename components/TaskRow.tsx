'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Card';
import type { TaskStatus } from '@/types/database';

function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Une tâche extraite d'un enregistrement (docs/roadmap.md item 72), avec une case à cocher qui bascule son statut. */
export default function TaskRow({
  id,
  title,
  dueDate,
  status,
  chatbotName,
}: {
  id: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  chatbotName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isOverdue = status === 'pending' && !!dueDate && dueDate < new Date().toISOString().slice(0, 10);

  async function toggle() {
    setLoading(true);
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status === 'done' ? 'pending' : 'done' }),
    }).catch(() => null);
    setLoading(false);
    if (res?.ok) router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette tâche ?')) return;
    setLoading(true);
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => null);
    setLoading(false);
    if (res?.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={status === 'done'}
          onChange={toggle}
          disabled={loading}
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="min-w-0">
          <p className={`truncate font-medium ${status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
            {title}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {chatbotName}
            {dueDate && ` · Échéance : ${formatDueDate(dueDate)}`}
          </p>
        </span>
      </label>
      <div className="flex flex-shrink-0 items-center gap-2">
        {isOverdue && <Badge tone="red">En retard</Badge>}
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
