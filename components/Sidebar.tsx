'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, ICONS } from '@/components/icons';
import { Logo } from '@/components/ui/Logo';
import SignOutButton from '@/components/SignOutButton';
import OrgSwitcher from '@/components/OrgSwitcher';

const NAV_ITEMS = [
  { href: '/dashboard', label: "Vue d'ensemble", icon: ICONS.grid },
  { href: '/dashboard/chatbots', label: 'Chatbots (site)', icon: ICONS.chat },
  { href: '/dashboard/second-cerveau', label: 'Second cerveau', icon: ICONS.index },
  { href: '/dashboard/documents', label: 'Documents', icon: ICONS.document },
  { href: '/dashboard/templates', label: 'Templates', icon: ICONS.layers },
  { href: '/dashboard/docs', label: 'Documentation', icon: ICONS.book },
  { href: '/dashboard/settings', label: 'Paramètres', icon: ICONS.settings },
];

export default function Sidebar({
  orgs,
  currentOrgId,
  userEmail,
  open,
  onClose,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  userEmail: string | undefined;
  // Mobile drawer state (components/DashboardShell.tsx) — below the `lg`
  // breakpoint this fixed-width sidebar would otherwise eat most of a phone
  // screen, so it becomes a slide-in drawer there; at `lg` and up it stays
  // the always-visible static sidebar this was before.
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-shrink-0 transform flex-col overflow-y-auto bg-brand-950 text-white transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
        <Link href="/">
          <Logo className="text-white" tone="inverted" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="-mr-2 flex h-9 w-9 items-center justify-center rounded-md text-brand-200 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <Icon className="h-5 w-5">{ICONS.close}</Icon>
        </button>
      </div>

      <OrgSwitcher orgs={orgs} currentOrgId={currentOrgId} />
      <p className="truncate px-6 py-2 text-xs text-brand-300">{userEmail}</p>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard' ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-brand-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0">{item.icon}</Icon>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <SignOutButton className="w-full justify-start text-brand-200 hover:bg-white/5 hover:text-white" />
      </div>
    </aside>
  );
}
