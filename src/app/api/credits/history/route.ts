import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    return NextResponse.json({
      success: true,
      entries: await DbManager.getCreditLedger(user.id),
      user,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load credit history';
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Authentication required') ? 401 : 500 }
    );
  }
}
