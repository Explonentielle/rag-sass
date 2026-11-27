import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/openai';
import { logWarn } from '@/lib/logger';

// Marge sous la limite de 25 Mo de l'API Whisper, même raisonnement que
// MAX_AUDIO_BYTES dans lib/extract.ts, mais une dictée de question est
// bien plus courte qu'une réunion entière (item 46), d'où une limite plus
// basse ici.
const MAX_DICTATION_BYTES = 10 * 1024 * 1024;

// Transcrit une courte dictée pour remplir le champ de saisie du chat
// (docs/roadmap.md item 71), dashboard uniquement (pas le widget public,
// voir le raisonnement déjà écarté pour le widget à l'item 46). Pas de
// document créé, pas de palier requis : coût marginal négligeable par
// rapport à la transcription de réunions.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file est requis.' }, { status: 400 });
  }
  if (file.size > MAX_DICTATION_BYTES) {
    return NextResponse.json(
      { error: `Enregistrement trop volumineux (limite ${Math.floor(MAX_DICTATION_BYTES / (1024 * 1024))} Mo).` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio(buffer, 'dictation.webm');
    return NextResponse.json({ text });
  } catch (err) {
    logWarn('transcribe.failed', { userId: user.id, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Échec de la transcription. Réessayez.' }, { status: 500 });
  }
}
