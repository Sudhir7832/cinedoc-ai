import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const requestedNext = req.nextUrl.searchParams.get('next') || '/';
  const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  // Determine the real public origin from headers (supports Nginx reverse proxy)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') || (req.url.startsWith('https') ? 'https' : 'http');
  const origin = host && !host.startsWith('127.0.0.1') && !host.startsWith('localhost')
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);

  const redirect = NextResponse.redirect(new URL(safeNext, origin));
  if (!code) return redirect;

  const auth = createRouteSupabase(req);
  const { error } = await auth.client.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=confirmation_failed', origin));
  }
  return auth.applyCookies(redirect);
}
