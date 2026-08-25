'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon, ICONS } from '@/components/icons';

export default function SignOutButton({
  className = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}: {
  className?: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${className}`}
    >
      <Icon className="h-4 w-4">{ICONS.logout}</Icon>
      Se déconnecter
    </button>
  );
}
