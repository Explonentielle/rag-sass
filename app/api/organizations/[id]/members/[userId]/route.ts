import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { OrgRole } from '@/types/database';

async function getMembership(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string
) {
  const { data } = await supabase
    .from('users_organizations')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role as OrgRole | undefined;
}

async function countOwners(supabase: ReturnType<typeof createClient>, orgId: string) {
  const { count } = await supabase
    .from('users_organizations')
    .select('user_id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('role', 'owner');
  return count ?? 0;
}

/** Change a member's role. Only an owner can grant/revoke the owner role
 * itself (an admin can only move someone between admin/member) — otherwise
 * an admin could self-escalate by promoting themselves to owner. Always
 * keeps at least one owner. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const callerRole = await getMembership(supabase, params.id, user.id);
  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return NextResponse.json(
      { error: 'Seuls les propriétaires/administrateurs peuvent changer un rôle.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const role: OrgRole | undefined = body?.role;
  if (role !== 'owner' && role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'role doit être owner, admin ou member.' }, { status: 400 });
  }

  const targetRole = await getMembership(supabase, params.id, params.userId);
  if (!targetRole) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }

  const touchesOwnerRole = role === 'owner' || targetRole === 'owner';
  if (touchesOwnerRole && callerRole !== 'owner') {
    return NextResponse.json(
      { error: 'Seul un propriétaire peut attribuer ou retirer le rôle propriétaire.' },
      { status: 403 }
    );
  }

  if (targetRole === 'owner' && role !== 'owner') {
    const owners = await countOwners(supabase, params.id);
    if (owners <= 1) {
      return NextResponse.json(
        {
          error:
            "Impossible : c'est le dernier propriétaire de l'organisation. Attribuez le rôle à quelqu'un d'autre d'abord.",
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from('users_organizations')
    .update({ role })
    .eq('organization_id', params.id)
    .eq('user_id', params.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/** Remove a member from the organization — either an owner/admin removing
 * someone else, or a member removing themselves ("leave org"). Always keeps
 * at least one owner. */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const callerRole = await getMembership(supabase, params.id, user.id);
  if (!callerRole) {
    return NextResponse.json({ error: "Vous n'appartenez pas à cette organisation." }, { status: 403 });
  }

  const isSelf = user.id === params.userId;
  if (!isSelf && callerRole !== 'owner' && callerRole !== 'admin') {
    return NextResponse.json(
      { error: 'Seuls les propriétaires/administrateurs peuvent retirer un membre.' },
      { status: 403 }
    );
  }

  const targetRole = await getMembership(supabase, params.id, params.userId);
  if (!targetRole) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }

  if (targetRole === 'owner' && !isSelf && callerRole !== 'owner') {
    return NextResponse.json(
      { error: 'Seul un propriétaire peut retirer un autre propriétaire.' },
      { status: 403 }
    );
  }

  if (targetRole === 'owner') {
    const owners = await countOwners(supabase, params.id);
    if (owners <= 1) {
      return NextResponse.json(
        {
          error: isSelf
            ? "Vous êtes le dernier propriétaire — attribuez le rôle à quelqu'un d'autre avant de quitter, ou supprimez l'organisation."
            : "Impossible : c'est le dernier propriétaire de l'organisation.",
        },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from('users_organizations')
    .delete()
    .eq('organization_id', params.id)
    .eq('user_id', params.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
