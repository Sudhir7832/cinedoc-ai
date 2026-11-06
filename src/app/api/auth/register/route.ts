import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';
import { DbManager } from '@/lib/db';
import { getCanonicalOrigin, requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { registerSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

function toCanonicalEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf('@');
  if (atIdx === -1) return trimmed;
  let local = trimmed.slice(0, atIdx);
  let domain = trimmed.slice(atIdx + 1);

  if (domain === 'googlemail.com') domain = 'gmail.com';

  if (domain === 'gmail.com') {
    const plusIdx = local.indexOf('+');
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
    local = local.replace(/\./g, '');
  } else {
    const plusIdx = local.indexOf('+');
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
  }

  return `${local}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'auth-register', limit: 5, windowSeconds: 3600, failClosed: true });
    if (limited) return limited;
    const { email, password, name } = await parseJsonBody(req, registerSchema, 4 * 1024);

    const canonical = toCanonicalEmail(email);

    // Prevent duplicate registrations or alias farming (+1, dots) to collect free welcome credits repeatedly
    const existingUser = await DbManager.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'An account with this email address already exists. Please sign in.' }, { status: 400 });
    }

    if (canonical !== email) {
      const canonicalUser = await DbManager.getUserByEmail(canonical);
      if (canonicalUser) {
        return NextResponse.json({
          success: false,
          error: 'An account with this email address already exists. Free welcome credits are limited to 1 per user.',
        }, { status: 400 });
      }
    }

    const auth = createRouteSupabase(req);
    const { data, error } = await auth.client.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || email.split('@')[0] },
        emailRedirectTo: `${getCanonicalOrigin(req)}/auth/callback`,
      },
    });
    if (error || !data.user) {
      return NextResponse.json({ success: false, error: error?.message || 'Unable to create account.' }, { status: 400 });
    }

    // In Supabase, if the user already existed in auth.users, identities array is empty
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json({ success: false, error: 'An account with this email address already exists. Please sign in.' }, { status: 400 });
    }

    const profile = await DbManager.getUserById(data.user.id);
    const user = profile ? DbManager.toSafeUser(profile) : null;
    const response = NextResponse.json({
      success: true,
      user,
      requiresEmailConfirmation: !data.session,
      message: data.session ? 'Account created successfully.' : 'Check your email to confirm your account before signing in.',
    });
    return auth.applyCookies(response);
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Registration failed.');
  }
}
