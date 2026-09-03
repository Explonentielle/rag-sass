import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const label: string | undefined = body?.label?.trim();
  const template: string | undefined = body?.template?.trim();

  if (!label && !template) {
    return NextResponse.json({ error: 'label ou template est requis.' }, { status: 400 });
  }

  // RLS (custom_templates_update: is_org_member) enforces tenant scoping.
  const { data, error } = await supabase
    .from('custom_templates')
    .update({ ...(label ? { label } : {}), ...(template ? { template } : {}) })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS (custom_templates_delete: is_org_admin) enforces tenant scoping and
  // role requirement.
  const { error } = await supabase.from('custom_templates').delete().eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
