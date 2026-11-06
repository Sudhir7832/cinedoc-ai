import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'auth-logout', limit: 20, windowSeconds: 300, failClosed: true });
    if (limited) return limited;
    const auth = createRouteSupabase(req);
    await auth.client.auth.signOut();
    return auth.applyCookies(NextResponse.json({ success: true }));
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Logout failed.');
  }
}
