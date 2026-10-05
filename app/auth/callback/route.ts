import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// Handles Supabase's email confirmation / magic link / invite redirect.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // An invited account (docs/roadmap.md item 13) has no password yet — only
  // this one-time session from the invite email — so it must land on
  // set-password first, or the person could never log back in afterwards.
  if (type === 'invite') {
    return NextResponse.redirect(`${origin}/set-password`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
