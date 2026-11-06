import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { JobManager } from '@/lib/jobs/manager';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJobId } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseJobId((await params).id);
    const job = await StorageManager.loadJob(id);
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-cancel', limit: 20, windowSeconds: 600, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    return NextResponse.json({ success: true, job: await JobManager.cancelJob(id) });
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to stop production.');
  }
}
