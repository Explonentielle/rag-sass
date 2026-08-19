import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPromptTemplate, PROMPT_TEMPLATES } from '@/lib/prompts';

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
  const name: string | undefined = body?.name?.trim();
  const templateId: string | undefined = body?.templateId;

  if (!organizationId || !name) {
    return NextResponse.json({ error: 'organizationId et name sont requis.' }, { status: 400 });
  }

  const template = getPromptTemplate(templateId ?? '') ?? PROMPT_TEMPLATES[0];

  // RLS (chatbots_insert policy: is_org_member) enforces that the user
  // actually belongs to this organization — no extra check needed here.
  const { data, error } = await supabase
    .from('chatbots')
    .insert({
      organization_id: organizationId,
      name,
      system_prompt_template: template.template,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
