import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { discoverSiteUrls, UnsupportedDocumentError } from '@/lib/extract';
import { normalizePageUrl } from '@/lib/siteLinks';
import { logWarn, logError } from '@/lib/logger';

// "Scan the whole site" (docs/roadmap.md item 50), step 1: lists the pages of
// the site so the owner can pick which ones to add. Nothing is ingested here —
// each selected page is then sent to /api/documents/upload-url as its own
// document. Discovery fetches several pages, so give it more room than a
// typical request.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const chatbotId: string | undefined = body?.chatbotId;
  const url: string | undefined = body?.url?.trim();
  if (!chatbotId || !url) {
    return NextResponse.json({ error: 'chatbotId et url sont requis.' }, { status: 400 });
  }

  // RLS scopes this to the caller's org — a chatbotId from another tenant
  // isn't found, so this can't be used as an anonymous page fetcher.
  const { data: chatbot } = await supabase.from('chatbots').select('id').eq('id', chatbotId).single();
  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot introuvable.' }, { status: 404 });
  }

  let pages: string[];
  try {
    pages = await discoverSiteUrls(url);
  } catch (err) {
    if (err instanceof UnsupportedDocumentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Erreur inconnue.';
    logError('discover_urls.failed', { userId: user.id, chatbotId, error: message });
    return NextResponse.json({ error: 'Impossible de parcourir ce site.' }, { status: 500 });
  }

  // Pages already added as documents, so the picker can leave them unchecked
  // instead of creating duplicates on a re-scan.
  const { data: existing, error: existingError } = await supabase
    .from('documents')
    .select('source_url')
    .eq('chatbot_id', chatbot.id)
    .not('source_url', 'is', null);
  if (existingError) {
    logWarn('discover_urls.existing_lookup_failed', { chatbotId, error: existingError.message });
  }

  const alreadyAdded = new Set<string>();
  for (const row of existing ?? []) {
    if (!row.source_url) continue;
    try {
      alreadyAdded.add(normalizePageUrl(new URL(row.source_url)));
    } catch {
      // A malformed stored URL just can't match anything.
    }
  }

  return NextResponse.json({
    pages: pages.map((page) => ({ url: page, alreadyAdded: alreadyAdded.has(page) })),
  });
}
