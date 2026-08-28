'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnClickOutside } from '@/lib/useOnClickOutside';
import { Icon, ICONS } from '@/components/icons';
import CreateOrgModal from '@/components/CreateOrgModal';

interface Org {
  id: string;
  name: string;
}

export default function OrgSwitcher({ orgs, currentOrgId }: { orgs: Org[]; currentOrgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setOpen(false));

  const currentOrg = orgs.find((o) => o.id === currentOrgId);

  async function handleSwitch(orgId: string) {
    if (orgId === currentOrgId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    });
    setSwitching(false);
    setOpen(false);
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div ref={menuRef} className="relative border-b border-white/10 px-3 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-white/5"
      >
        <span className="truncate text-sm font-medium text-white">
          {switching ? 'Changement...' : currentOrg?.name}
        </span>
        <Icon className="h-4 w-4 flex-shrink-0 text-brand-300">
          <polyline points="6,9 12,15 18,9" />
        </Icon>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 rounded-md border border-white/10 bg-brand-900 py-1 shadow-xl">
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                org.id === currentOrgId
                  ? 'text-white'
                  : 'text-brand-200 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="truncate">{org.name}</span>
              {org.id === currentOrgId && (
                <Icon className="h-4 w-4 flex-shrink-0">{ICONS.checkCircle}</Icon>
              )}
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button
            onClick={() => {
              setOpen(false);
              setShowCreateModal(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-200 hover:bg-white/5 hover:text-white"
          >
            + Nouvelle organisation
          </button>
        </div>
      )}

      {showCreateModal && <CreateOrgModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
