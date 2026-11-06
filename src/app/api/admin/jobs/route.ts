import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { StorageManager } from '@/lib/storage';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function GET(req: NextRequest) {
  try {
    const admin = await SessionManager.requireAdmin(req);
    const limited = await rateLimit(req, { bucket: 'admin-jobs', limit: 60, windowSeconds: 60, failClosed: true, discriminator: admin.id });
    if (limited) return limited;
    const jobs = await StorageManager.listJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to load productions.');
  }
}
