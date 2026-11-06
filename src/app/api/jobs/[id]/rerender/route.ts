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
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-rerender', limit: 3, windowSeconds: 3600, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    if (job.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Only completed productions can be re-rendered.' }, { status: 409 });
    }
    if (job.billing?.enabled && job.billing.status === 'released') {
      const { DbManager } = await import('@/lib/db');
      await DbManager.resumeJobCredits(job.id);
    }

    // Run reRender in background so the client doesn't time out, while progress updates in real-time
    JobManager.reRenderVideo(id).catch(err => {
      console.error(`[Re-render Background Task Error for ${id}]:`, err);
    });

    return NextResponse.json({
      success: true,
      message: 'Video re-rendering started. Progress will update live.',
      jobId: id,
    });
  } catch (err: unknown) {
    console.error('[Re-render API Error]:', err);
    const message = err instanceof Error ? err.message : 'Failed to start video re-rendering';
    const status = message.includes('Authentication required')
      ? 401
      : message.includes('Insufficient credits')
        ? 402
        : message.includes('Forbidden')
          ? 403
          : message.includes('currently busy')
            ? 409
            : message.includes('Invalid job ID')
              ? 400
              : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
