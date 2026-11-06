import { NextRequest, NextResponse } from 'next/server';
import { createProxySupabase, isServerSupabaseConfigured } from '@/lib/supabase/server';
import { getCanonicalOrigin, isCookieAuthenticatedMutation, requireSameOrigin } from '@/lib/security/origin';

export default async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/auth/callback') {
    try {
      getCanonicalOrigin(req);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request host.' }, { status: 400 });
    }
  }
  if (isCookieAuthenticatedMutation(req) && req.nextUrl.pathname !== '/api/webhooks/dodo') {
    try {
      requireSameOrigin(req);
    } catch {
      return NextResponse.json({ success: false, error: 'Cross-origin request blocked.' }, { status: 403 });
    }
  }
  const response = NextResponse.next({ request: req });
  if (!isServerSupabaseConfigured()) return response;
  const supabase = createProxySupabase(req, response);
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm)).*)',
    '/(api|trpc)(.*)',
  ],
};
