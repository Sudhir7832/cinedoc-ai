import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJobId } from '@/lib/security/schemas';

function errorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('Authentication required')) return 401;
  if (message.includes('Forbidden')) return 403;
  if (message.includes('Invalid job ID')) return 400;
  return 500;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseJobId((await params).id);
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-read', limit: 180, windowSeconds: 60, failClosed: false, discriminator: user.id });
    if (limited) return limited;
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Failed to load job' }, { status: errorStatus(err) });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseJobId((await params).id);
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-delete', limit: 10, windowSeconds: 3600, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ success: false, error: 'Stop this production before deleting it.' }, { status: 409 });
    }
    if (job.billing?.enabled && job.billing.status !== 'settled') {
      const { DbManager } = await import('@/lib/db');
      await DbManager.releaseJobCredits(job.id);
    }
    await StorageManager.deleteJob(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Failed to delete job' }, { status: errorStatus(err) });
  }
}
