'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Card, Input } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Member {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

const ROLE_LABELS: Record<Member['role'], string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  member: 'Membre',
};

const ROLE_OPTIONS: Member['role'][] = ['member', 'admin', 'owner'];

export default function TeamMembers({
  organizationId,
  currentUserId,
  currentUserRole,
}: {
  organizationId: string;
  currentUserId: string;
  currentUserRole: 'owner' | 'admin' | 'member';
}) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  async function loadMembers() {
    const res = await fetch(`/api/organizations/${organizationId}/members`);
    if (res.ok) {
      const body = await res.json();
      setMembers(body.members);
    }
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/organizations/${organizationId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setInviting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Erreur lors de l'ajout.");
      return;
    }

    const body = await res.json().catch(() => ({}));
    setEmail('');
    setSuccess(body.invited ? 'Invitation envoyée par email.' : 'Membre ajouté.');
    loadMembers();
  }

  async function handleRoleChange(userId: string, role: Member['role']) {
    setBusyUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    setBusyUserId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors du changement de rôle.');
      return;
    }
    loadMembers();
    if (userId === currentUserId) router.refresh();
  }

  async function handleRemove(userId: string, isSelf: boolean) {
    if (
      !confirm(
        isSelf
          ? 'Quitter cette organisation ?'
          : "Retirer ce membre de l'organisation ?"
      )
    ) {
      return;
    }

    setBusyUserId(userId);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
      method: 'DELETE',
    });

    setBusyUserId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Erreur lors du retrait.');
      return;
    }

    if (isSelf) {
      router.push('/dashboard');
      router.refresh();
      return;
    }
    loadMembers();
  }

  return (
    <Card className="divide-y divide-slate-100">
      {members === null && <div className="px-6 py-4 text-sm text-slate-400">Chargement...</div>}
      {members?.map((m) => {
        const isSelf = m.userId === currentUserId;
        // Only an owner can touch the owner role itself (grant or revoke);
        // an admin can still move people between admin/member.
        const canEditThisRow =
          (canManage || isSelf) && !(m.role === 'owner' && !isSelf && currentUserRole !== 'owner');
        const canChangeRole = canManage && !(m.role === 'owner' && currentUserRole !== 'owner');

        return (
          <div key={m.userId} className="flex items-center justify-between gap-3 px-6 py-4 text-sm">
            <div className="min-w-0">
              <p className="truncate text-slate-900">
                {m.email} {isSelf && <span className="text-xs text-slate-400">(vous)</span>}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {canChangeRole ? (
                <select
                  value={m.role}
                  disabled={busyUserId === m.userId}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value as Member['role'])}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge tone={m.role === 'owner' ? 'blue' : 'neutral'}>{ROLE_LABELS[m.role]}</Badge>
              )}
              {canEditThisRow && (
                <button
                  type="button"
                  disabled={busyUserId === m.userId}
                  onClick={() => handleRemove(m.userId, isSelf)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isSelf ? 'Quitter' : 'Retirer'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {canManage && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              type="email"
              required
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={inviting} className="flex-shrink-0 whitespace-nowrap">
            {inviting ? 'Ajout...' : '+ Ajouter'}
          </Button>
        </form>
      )}
      {(error || success) && (
        <div className="px-6 py-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </div>
      )}
      {canManage && (
        <p className="px-6 py-3 text-xs text-slate-400">
          Si la personne a déjà un compte Corpus.ai, elle est ajoutée immédiatement. Sinon, un
          email d'invitation lui est envoyé pour créer son compte.
        </p>
      )}
    </Card>
  );
}
