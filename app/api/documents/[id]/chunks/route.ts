import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDocumentChunks } from '@/lib/elasticsearch';
import { logError } from '@/lib/logger';

// Lets someone inspect what ingestion actually indexed for a document
// (docs/roadmap.md item 45) — especially useful with AI-assisted indexing
// (item 18), whose output isn't deterministic and is worth double-checking.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // RLS (documents_select: scoped via chatbots.organization_id) enforces
  // tenant scoping — a documentId from another org simply won't be found.
  const { data: document } = await supabase.from('documents').select('id').eq('id', params.id).single();
  if (!document) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }

  try {
    const chunks = await getDocumentChunks(document.id);
    return NextResponse.json({ chunks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('document_chunks.fetch_failed', { documentId: document.id, error: message });
    return NextResponse.json({ error: `Échec de la récupération: ${message}` }, { status: 500 });
  }
}
