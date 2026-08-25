'use client';

import { useEffect, useState } from 'react';
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

export default function TeamMembers({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    setEmail('');
    setSuccess('Membre ajouté.');
    loadMembers();
  }

  return (
    <Card className="divide-y divide-slate-100">
      {members === null && <div className="px-6 py-4 text-sm text-slate-400">Chargement...</div>}
      {members?.map((m) => (
        <div key={m.userId} className="flex items-center justify-between px-6 py-4 text-sm">
          <span className="text-slate-900">{m.email}</span>
          <Badge tone={m.role === 'owner' ? 'blue' : 'neutral'}>{ROLE_LABELS[m.role]}</Badge>
        </div>
      ))}

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
      {(error || success) && (
        <div className="px-6 py-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </div>
      )}
      <p className="px-6 py-3 text-xs text-slate-400">
        Fonctionne uniquement pour une personne ayant déjà un compte Corpus.ai (aucun email
        d'invitation n'est envoyé pour l'instant).
      </p>
    </Card>
  );
}
