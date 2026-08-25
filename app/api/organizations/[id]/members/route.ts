import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

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

  // No invite email is sent — this only works for people who already have a
  // Corpus.ai account. Inviting someone new would require sending a real
  // email, which hits the same tiny Supabase free-tier rate limit as
  // signup confirmation; deferred until a custom SMTP provider is set up.
  const admin = getAdminClient();
  let targetUserId: string | undefined;
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
    return NextResponse.json(
      {
        error:
          "Aucun compte trouvé avec cet email. Cette personne doit d'abord créer un compte sur /signup avant de pouvoir être ajoutée.",
      },
      { status: 404 }
    );
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

  return NextResponse.json({ ok: true }, { status: 201 });
}
