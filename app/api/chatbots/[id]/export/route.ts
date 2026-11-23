import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCsv } from '@/lib/csv';
import type { ExtractedFieldsJson } from '@/types/database';

/**
 * Exports a digitizer's extracted fields as CSV (docs/roadmap.md item 70).
 * Columns are the union of every label seen across its documents, in order
 * of first appearance: documents of different formats (or 'libre', whose
 * labels vary per document) end up sharing one sheet with blank cells where
 * a given document has no value for that column, rather than one export
 * per format.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS (chatbots_select: is_org_member) scopes this, a chatbot from
  // another tenant simply won't be found.
  const { data: chatbot, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, name, use_case')
    .eq('id', params.id)
    .single();

  if (chatbotError || !chatbot || chatbot.use_case !== 'paperwork_digitizer') {
    return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
  }

  const { data: documents, error: documentsError } = await supabase
    .from('documents')
    .select('filename, uploaded_at, extracted_fields')
    .eq('chatbot_id', chatbot.id)
    .order('uploaded_at', { ascending: false });

  if (documentsError) {
    return NextResponse.json({ error: "Échec de la récupération des documents." }, { status: 400 });
  }

  // postgrest-js's type inference for a select-string column doesn't narrow
  // this to ExtractedFieldsJson (pre-existing gap, same pattern as
  // app/dashboard/paperasse/[id]/page.tsx's `documentFormat` annotation):
  // annotate explicitly.
  const extractedFieldsOf = (doc: { extracted_fields: unknown }): ExtractedFieldsJson =>
    (doc.extracted_fields as ExtractedFieldsJson | null) ?? [];

  const labels: string[] = [];
  for (const doc of documents ?? []) {
    for (const field of extractedFieldsOf(doc)) {
      if (!labels.includes(field.label)) labels.push(field.label);
    }
  }

  const rows = [
    ['Fichier', 'Date', ...labels],
    ...(documents ?? []).map((doc) => {
      const byLabel = new Map(extractedFieldsOf(doc).map((f) => [f.label, f.value]));
      return [doc.filename, new Date(doc.uploaded_at).toLocaleDateString('fr-FR'), ...labels.map((l) => byLabel.get(l))];
    }),
  ];

  const filename = `${chatbot.name.replace(/[^a-zA-Z0-9_-]+/g, '_')}.csv`;

  return new NextResponse(buildCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
