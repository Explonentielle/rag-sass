'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, ICONS } from '@/components/icons';
import { Logo } from '@/components/ui/Logo';
import SignOutButton from '@/components/SignOutButton';
import OrgSwitcher from '@/components/OrgSwitcher';

const NAV_ITEMS = [
  { href: '/dashboard', label: "Vue d'ensemble", icon: ICONS.grid },
  { href: '/dashboard/chatbots', label: 'Chatbots', icon: ICONS.chat },
  { href: '/dashboard/documents', label: 'Documents', icon: ICONS.document },
  { href: '/dashboard/templates', label: 'Templates', icon: ICONS.layers },
  { href: '/dashboard/docs', label: 'Documentation', icon: ICONS.book },
  { href: '/dashboard/settings', label: 'Paramètres', icon: ICONS.settings },
];

export default function Sidebar({
  orgs,
  currentOrgId,
  userEmail,
}: {
  orgs: { id: string; name: string }[];
  currentOrgId: string;
  userEmail: string | undefined;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-shrink-0 flex-col overflow-y-auto bg-brand-950 text-white">
      <div className="flex h-16 items-center border-b border-white/10 px-6">
        <Link href="/">
          <Logo className="text-white" tone="inverted" />
        </Link>
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
