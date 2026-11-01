import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const users = (await DbManager.getUsers()).map(user => DbManager.toSafeUser(user));
    return NextResponse.json({ success: true, users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Forbidden') ? 403 : 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const body = await req.json();
    const { email, password, name, role } = body;

    const user = await DbManager.createUser({ email, password, name, role });
    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unable to create user' },
      { status: 400 }
    );
  }
}
