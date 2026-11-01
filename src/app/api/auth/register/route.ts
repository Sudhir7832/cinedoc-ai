import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';
import { DbManager } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    if (!email || !password) return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });

    const auth = createRouteSupabase(req);
    const { data, error } = await auth.client.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || email.split('@')[0] },
        emailRedirectTo: `${req.nextUrl.origin}/auth/callback`,
      },
    });
    if (error || !data.user) return NextResponse.json({ success: false, error: error?.message || 'Registration failed' }, { status: 400 });
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
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Registration failed' }, { status: 500 });
  }
}
