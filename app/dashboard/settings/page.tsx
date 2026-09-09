import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import OrgSettingsForm from '@/components/OrgSettingsForm';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import TeamMembers from '@/components/TeamMembers';
import DeleteOrgSection from '@/components/DeleteOrgSection';
import { Badge, Card } from '@/components/ui/Card';
import { PLAN_LABELS } from '@/lib/usage';

export default async function SettingsPage() {
  const org = await getCurrentOrg();
  if (!org) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const roleLabels: Record<string, string> = {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    member: 'Membre',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Organisation et compte</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Organisation</h2>
        {org.role === 'owner' || org.role === 'admin' ? (
          <Card className="p-6">
            <OrgSettingsForm orgId={org.id} initialName={org.name} initialPlan={org.plan} />
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100">
            <div className="flex items-center justify-between px-6 py-4 text-sm">
              <span className="text-slate-500">Nom</span>
              <span className="font-medium text-slate-900">{org.name}</span>
            </div>
            <div className="flex items-center justify-between px-6 py-4 text-sm">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900">{PLAN_LABELS[org.plan]}</span>
            </div>
            <p className="px-6 py-3 text-xs text-slate-400">
              Réservé aux propriétaires et administrateurs.
            </p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Membres</h2>
        {user && (
          <TeamMembers organizationId={org.id} currentUserId={user.id} currentUserRole={org.role} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Compte</h2>
        <Card className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-sm">
            <span className="text-slate-500">Rôle</span>
            <Badge tone="blue">{roleLabels[org.role]}</Badge>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Mot de passe</h2>
        <Card className="p-6">
          <ChangePasswordForm />
        </Card>
      </section>

      {org.role === 'owner' && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Zone dangereuse</h2>
          <DeleteOrgSection orgId={org.id} orgName={org.name} />
        </section>
      )}
    </div>
  );
}
