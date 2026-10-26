'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Icon, ICONS } from '@/components/icons';
import { Logo } from '@/components/ui/Logo';

// Owns the mobile sidebar-drawer state — app/dashboard/layout.tsx is a
// Server Component (awaits Supabase calls for org/user data) and can't hold
// useState itself, so that state lives here instead, one level down.
export default function DashboardShell({
  orgs,
  currentOrgId,
  userEmail,
  children,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  userEmail: string | undefined;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgs={orgs} currentOrgId={currentOrgId} userEmail={userEmail} open={open} onClose={() => setOpen(false)} />
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
          >
            <Icon className="h-5 w-5">{ICONS.menu}</Icon>
          </button>
          <Logo />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
