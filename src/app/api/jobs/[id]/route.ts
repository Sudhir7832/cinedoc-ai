import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

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
    const { id } = await params;
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    await SessionManager.requireJobAccess(req, job);
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
    const { id } = await params;
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    await SessionManager.requireJobAccess(req, job);
    if (job.userId && job.creditStatus === 'reserved') {
      const { DbManager } = await import('@/lib/db');
      await DbManager.releaseReservedCredits(job.userId, job.creditCost || 0);
    }
    await StorageManager.deleteJob(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Failed to delete job' }, { status: errorStatus(err) });
  }
}
