import { createClient } from '@/lib/supabase/server';

export interface CurrentOrg {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

/**
 * Returns the current user's first organization, or null if they don't
 * belong to one yet. The MVP assumes one org per user (schema supports
 * many — multi-org switching is a later iteration).
 */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users_organizations')
    .select('role, organizations(id, name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!data || !data.organizations) return null;

  const org = data.organizations as unknown as { id: string; name: string };
  return { id: org.id, name: org.name, role: data.role };
}
