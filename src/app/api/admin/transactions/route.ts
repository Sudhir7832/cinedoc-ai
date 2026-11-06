import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-transactions', limit: 60, windowSeconds: 60, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);

    const transactions = await DbManager.getTransactions();
    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to load payment transactions.');
  }
}

