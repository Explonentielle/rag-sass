import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PROMPT_TEMPLATES } from '@/lib/prompts';
import { PLAN_CHATBOT_LIMITS, PLAN_LABELS } from '@/lib/plans';
import type { ChatbotUseCase, OrgPlan } from '@/types/database';

const USE_CASES: ChatbotUseCase[] = ['site_widget', 'second_cerveau'];

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
  // Full prompt text, resolved client-side from either a default or a
  // custom (org-owned) template — the server doesn't need to distinguish.
  const systemPromptTemplate: string | undefined = body?.systemPromptTemplate?.trim();
  // Defaults true (current behavior: answers grounded in uploaded
  // documents). false = "prompt-only" chatbot, no retrieval at all — see
  // docs/roadmap.md item 23.
  const useDocuments: boolean = body?.useDocuments !== false;
  // 'site_widget' (défaut, rétrocompatible) = chatbot pensé pour être
  // embarqué sur un site public ; 'second_cerveau' = usage interne, pas de
  // widget/embed (docs/roadmap.md item 52).
  const useCaseInput: string | undefined = body?.useCase;
  const useCase: ChatbotUseCase = USE_CASES.includes(useCaseInput as ChatbotUseCase)
    ? (useCaseInput as ChatbotUseCase)
    : 'site_widget';

  if (!organizationId || !name) {
    return NextResponse.json({ error: 'organizationId et name sont requis.' }, { status: 400 });
  }

  // RLS (chatbots_insert policy: is_org_member) enforces that the user
  // actually belongs to this organization; no extra check needed here.
  // Entitlement cap (docs/roadmap.md item 56): 1 chatbot on free/solo,
  // unlimited on pme/metier. Checked here rather than relying on RLS
  // since it depends on a cross-table count, not just membership.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, plan')
    .eq('id', organizationId)
    .single();
  if (orgError || !org) {
    return NextResponse.json({ error: 'Organisation introuvable.' }, { status: 404 });
  }
  // postgrest-js's type inference for a bare single-column .select('plan')
  // doesn't narrow to the Row type here (pre-existing gap, see the same
  // pattern in app/api/chatbots/[id]/route.ts): annotate explicitly.
  const plan: OrgPlan = org.plan;

  const chatbotLimit = PLAN_CHATBOT_LIMITS[plan];
  if (chatbotLimit !== null) {
    const { count, error: countError } = await supabase
      .from('chatbots')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 400 });
    }
    if ((count ?? 0) >= chatbotLimit) {
      return NextResponse.json(
        {
          error: `Le palier ${PLAN_LABELS[plan]} est limité à ${chatbotLimit} assistant${chatbotLimit > 1 ? 's' : ''}. Passez à un palier supérieur pour en créer davantage.`,
        },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabase
    .from('chatbots')
    .insert({
      organization_id: organizationId,
      name,
      system_prompt_template: systemPromptTemplate || PROMPT_TEMPLATES[0].template,
      use_documents: useDocuments,
      use_case: useCase,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
