import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const auth = createRouteSupabase(req);
  await auth.client.auth.signOut();
  return auth.applyCookies(NextResponse.json({ success: true }));
}
