import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobs/manager';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await StorageManager.loadJob(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    await SessionManager.requireJobAccess(req, existing);

    const job = await JobManager.retryJob(id);
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retry job';
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Forbidden')
        ? 403
        : message.includes('Invalid job ID')
          ? 400
          : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
