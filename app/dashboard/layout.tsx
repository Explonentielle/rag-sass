import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/org';
import Sidebar from '@/components/Sidebar';

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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={org.name} userEmail={user?.email} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
