import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg, getUserOrgs } from '@/lib/org';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const org = await getCurrentOrg();

  if (!org) {
    // No organization yet: full-bleed centered onboarding, no sidebar/nav to
    // pages that assume an org exists.
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  const orgs = await getUserOrgs();

  return (
    <DashboardShell orgs={orgs} currentOrgId={org.id} userEmail={user?.email}>
      {children}
    </DashboardShell>
  );
}
