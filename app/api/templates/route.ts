import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId: string | undefined = body?.organizationId;
  const label: string | undefined = body?.label?.trim();
  const template: string | undefined = body?.template?.trim();

  if (!organizationId || !label || !template) {
    return NextResponse.json(
      { error: 'organizationId, label et template sont requis.' },
      { status: 400 }
    );
  }

  // RLS (custom_templates_insert: is_org_member) enforces tenant scoping.
  const { data, error } = await supabase
    .from('custom_templates')
    .insert({ organization_id: organizationId, label, template })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
