import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { OrgPlan } from '@/types/database';

export const ACTIVE_ORG_COOKIE = 'active_org_id';

export interface CurrentOrg {
  id: string;
  name: string;
  plan: OrgPlan;
  role: 'owner' | 'admin' | 'member';
}

/** All organizations the current user belongs to, in the order they joined. */
export async function getUserOrgs(): Promise<CurrentOrg[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('users_organizations')
    .select('role, created_at, organizations(id, name, plan)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  // A failed query must never be mistaken for "user has zero orgs" — that
  // silently sends an existing user through onboarding again (and risks
  // them creating a duplicate org). Surface it instead, e.g. if a migration
  // (like 0009_organization_plan.sql, adding the `plan` column this query
  // selects) hasn't been applied yet to this database.
  if (error) {
    throw new Error(`getUserOrgs: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      if (!org) return null;
      return { id: org.id, name: org.name, plan: org.plan, role: row.role };
    })
    .filter((o): o is CurrentOrg => o !== null);
}

/**
 * Returns the user's "active" organization: whichever one is remembered in
 * the active_org_id cookie (set via /api/organizations/switch), falling
 * back to the first organization they joined. Returns null if they don't
 * belong to any organization yet.
 */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const orgs = await getUserOrgs();
  if (orgs.length === 0) return null;

  const activeId = cookies().get(ACTIVE_ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === activeId) ?? orgs[0];
}
