import { NextRequest, NextResponse } from 'next/server';
import { createRouteSupabase } from '@/lib/supabase/server';
import { DbManager } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });

    const auth = createRouteSupabase(req);
    const { data, error } = await auth.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) return NextResponse.json({ success: false, error: error?.message || 'Invalid email or password' }, { status: 401 });
    const profile = await DbManager.getUserById(data.user.id);
    if (!profile) throw new Error('Supabase profile is missing. Run the database schema trigger.');
    return auth.applyCookies(NextResponse.json({ success: true, user: DbManager.toSafeUser(profile), message: 'Signed in successfully' }));
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Login failed' }, { status: 500 });
  }
}
