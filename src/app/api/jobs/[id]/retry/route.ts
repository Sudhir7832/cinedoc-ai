import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobs/manager';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJobId } from '@/lib/security/schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseJobId((await params).id);
    const existing = await StorageManager.loadJob(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    const user = await SessionManager.requireJobAccess(req, existing);
    const limited = await rateLimit(req, { bucket: 'job-retry', limit: 5, windowSeconds: 3600, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    if (!['failed', 'cancelled'].includes(existing.status)) {
      return NextResponse.json({ success: false, error: 'Only failed or stopped productions can be retried.' }, { status: 409 });
    }

    const job = await JobManager.retryJob(id);
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retry job';
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Insufficient credits')
        ? 402
        : message.includes('Forbidden')
          ? 403
          : message.includes('Invalid job ID')
            ? 400
            : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
