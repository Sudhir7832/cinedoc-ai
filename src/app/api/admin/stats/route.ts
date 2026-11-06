import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-stats', limit: 60, windowSeconds: 60, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const stats = await DbManager.getAdminStats();
    return NextResponse.json({ success: true, stats });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to load statistics.');
  }
}
