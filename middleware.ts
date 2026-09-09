import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Checks whether /embed/[chatbotId] may load at all (`is_public`), and
 * what parent sites are allowed to iframe it (`allowed_origins`). A direct
 * REST fetch with the service-role key, not the full supabase-js client —
 * this runs on the Edge runtime, and it's one cheap lookup, no need for the
 * client's extra surface. RLS would block this entirely for an anonymous
 * caller anyway (no session here), same reason /api/public-chat uses the
 * admin client.
 */
async function checkEmbedAccess(
  chatbotId: string
): Promise<{ ok: true; allowedOrigins: string[] } | { ok: false }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { ok: false };

  const res = await fetch(
    `${url}/rest/v1/chatbots?id=eq.${encodeURIComponent(chatbotId)}&select=is_public,allowed_origins`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  ).catch(() => null);
  if (!res?.ok) return { ok: false };

  const rows = await res.json().catch(() => null);
  const chatbot = Array.isArray(rows) ? rows[0] : null;
  if (!chatbot || !chatbot.is_public) return { ok: false };

  return { ok: true, allowedOrigins: chatbot.allowed_origins ?? [] };
}

// Refreshes the Supabase auth session on every request and redirects
// unauthenticated users away from the dashboard.
export async function middleware(request: NextRequest) {
  // /embed/[chatbotId]: gate on is_public, and set the CSP frame-ancestors
  // header that's the actual browser-enforced restriction on which sites
  // may iframe this page (see the long comment in
  // app/api/public-chat/route.ts — an Origin/Referer check on the chat API
  // itself can't see who framed the *page*, only who called the API).
  // Short-circuits before the auth/session logic below — irrelevant here,
  // this route has no session to refresh.
  const embedMatch = request.nextUrl.pathname.match(/^\/embed\/([^/]+)$/);
  if (embedMatch) {
    const access = await checkEmbedAccess(embedMatch[1]);
    if (!access.ok) {
      return new NextResponse("Ce chatbot n'est pas disponible.", { status: 404 });
    }
    const response = NextResponse.next({ request });
    if (access.allowedOrigins.length > 0) {
      response.headers.set(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${access.allowedOrigins.join(' ')}`
      );
    }
    return response;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/auth');

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
