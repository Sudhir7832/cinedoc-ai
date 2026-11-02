import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const requestedNext = req.nextUrl.searchParams.get('next') || '/';
  const safeNext = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
  const redirect = NextResponse.redirect(new URL(safeNext, req.url));
  if (!code) return redirect;

  const auth = createRouteSupabase(req);
  const { error } = await auth.client.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/?auth_error=confirmation_failed', req.url));
  return auth.applyCookies(redirect);
}
