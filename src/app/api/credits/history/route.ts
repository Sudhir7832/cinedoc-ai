import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    const [entries, transactions] = await Promise.all([
      DbManager.getCreditLedger(user.id),
      DbManager.getTransactionsByUserId(user.id),
    ]);
    return NextResponse.json({
      success: true,
      entries,
      transactions,
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
