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
  const systemPromptTemplate: string | undefined = body?.systemPromptTemplate;
  const name: string | undefined = body?.name?.trim();

  if (systemPromptTemplate === undefined && !name) {
    return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });
  }

  // RLS (chatbots_update: is_org_member) enforces tenant scoping.
  const { error } = await supabase
    .from('chatbots')
    .update({
      ...(systemPromptTemplate !== undefined ? { system_prompt_template: systemPromptTemplate } : {}),
      ...(name ? { name } : {}),
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
