import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { logError } from '@/lib/logger';
import { PLAN_MEMBER_LIMITS, PLAN_LABELS } from '@/lib/plans';
import type { OrgPlan } from '@/types/database';

async function requireMembership(supabase: ReturnType<typeof createClient>, orgId: string, userId: string) {
  const { data } = await supabase
    .from('users_organizations')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single();
  return data?.role as 'owner' | 'admin' | 'member' | undefined;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const role = await requireMembership(supabase, params.id, user.id);
  if (!role) {
    return NextResponse.json({ error: "Vous n'appartenez pas à cette organisation." }, { status: 403 });
  }

  const { data: memberships, error } = await supabase
    .from('users_organizations')
    .select('user_id, role, created_at')
    .eq('organization_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Emails live in auth.users, not reachable via the RLS-scoped client —
  // resolve them with the admin client, scoped to exactly the user_ids we
  // already confirmed belong to this organization.
  const admin = getAdminClient();
  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { userId: m.user_id, email: data.user?.email ?? '(inconnu)', role: m.role, createdAt: m.created_at };
    })
  );

  return NextResponse.json({ members });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const role = await requireMembership(supabase, params.id, user.id);
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Seuls les propriétaires/administrateurs peuvent inviter des membres.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'email est requis.' }, { status: 400 });
  }

  // Entitlement cap (docs/roadmap.md item 56): 1 membre (le propriétaire
  // lui-même) sur free/solo, illimité sur pme/metier.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('plan')
    .eq('id', params.id)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });
  }
  // postgrest-js's type inference for a bare single-column .select('plan')
  // doesn't narrow to the Row type here (pre-existing gap, see the same
  // pattern in app/api/chatbots/[id]/route.ts): annotate explicitly.
  const plan: OrgPlan = org.plan;

  const memberLimit = PLAN_MEMBER_LIMITS[plan];
  if (memberLimit !== null) {
    const { count, error: countError } = await supabase
      .from('users_organizations')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', params.id);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) >= memberLimit) {
      return NextResponse.json(
        {
          error: `Le palier ${PLAN_LABELS[plan]} est limité à ${memberLimit} membre${memberLimit > 1 ? 's' : ''}. Passez à un palier supérieur pour inviter plus de monde.`,
        },
        { status: 403 }
      );
    }
  }

  const admin = getAdminClient();
  let targetUserId: string | undefined;
  let invited = false;
  let page = 1;
  while (!targetUserId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) targetUserId = found.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!targetUserId) {
    // No account with this email yet — create one and send a real invite
    // email (item 13), instead of refusing. Requires a custom SMTP
    // provider configured in Supabase (Project Settings > Auth > SMTP) —
    // see docs/deployment.md; without one, Supabase's own sender hits a
    // tiny free-tier rate limit, fine for testing, not for a real pilot.
    const origin = new URL(request.url).origin;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
    });
    if (error || !data.user) {
      logError('organization_members.invite_failed', {
        organizationId: params.id,
        error: error?.message,
      });
      return NextResponse.json(
        { error: error?.message || "Échec de l'envoi de l'invitation." },
        { status: 500 }
      );
    }
    targetUserId = data.user.id;
    invited = true;
  }

  const { error: insertError } = await admin
    .from('users_organizations')
    .insert({ organization_id: params.id, user_id: targetUserId, role: 'member' });

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'Cette personne fait déjà partie de votre organisation.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, invited }, { status: 201 });
}
