import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeOrigin } from '@/lib/embedAccess';

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
  const isPublic: boolean | undefined = body?.isPublic;
  const allowedOriginsInput: unknown = body?.allowedOrigins;
  const useDocuments: boolean | undefined = body?.useDocuments;

  let allowedOrigins: string[] | undefined;
  if (allowedOriginsInput !== undefined) {
    if (!Array.isArray(allowedOriginsInput) || !allowedOriginsInput.every((o) => typeof o === 'string')) {
      return NextResponse.json({ error: 'allowedOrigins doit être un tableau de chaînes.' }, { status: 400 });
    }
    const normalized = allowedOriginsInput.map(normalizeOrigin);
    if (normalized.some((o) => o === null)) {
      return NextResponse.json(
        { error: "Un des domaines n'est pas une URL valide (ex. https://exemple.com)." },
        { status: 400 }
      );
    }
    allowedOrigins = Array.from(new Set(normalized as string[]));
  }

  if (
    systemPromptTemplate === undefined &&
    !name &&
    isPublic === undefined &&
    allowedOrigins === undefined &&
    useDocuments === undefined
  ) {
    return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });
  }

  // RLS (chatbots_update: is_org_member) enforces tenant scoping.
  const { error } = await supabase
    .from('chatbots')
    .update({
      ...(systemPromptTemplate !== undefined ? { system_prompt_template: systemPromptTemplate } : {}),
      ...(name ? { name } : {}),
      ...(isPublic !== undefined ? { is_public: isPublic } : {}),
      ...(allowedOrigins !== undefined ? { allowed_origins: allowedOrigins } : {}),
      ...(useDocuments !== undefined ? { use_documents: useDocuments } : {}),
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
