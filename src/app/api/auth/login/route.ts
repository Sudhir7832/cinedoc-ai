import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';
import { DbManager } from '@/lib/db';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { loginSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'auth-login', limit: 10, windowSeconds: 900, failClosed: true });
    if (limited) return limited;
    const { email, password } = await parseJsonBody(req, loginSchema, 4 * 1024);

    const auth = createRouteSupabase(req);
    const { data, error } = await auth.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    const profile = await DbManager.getUserById(data.user.id);
    if (!profile) throw new Error('Profile unavailable.');
    return auth.applyCookies(NextResponse.json({ success: true, user: DbManager.toSafeUser(profile), message: 'Signed in successfully' }));
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Login failed.');
  }
}
