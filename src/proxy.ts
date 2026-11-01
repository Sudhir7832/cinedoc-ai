import { NextRequest, NextResponse } from 'next/server';
import { createProxySupabase, isServerSupabaseConfigured } from '@/lib/supabase/server';

export default async function proxy(req: NextRequest) {
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
