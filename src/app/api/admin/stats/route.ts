import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const stats = await DbManager.getAdminStats();
    return NextResponse.json({ success: true, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Forbidden') ? 403 : 401 }
    );
  }
}
