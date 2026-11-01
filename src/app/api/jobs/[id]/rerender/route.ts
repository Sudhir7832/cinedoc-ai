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
    const job = await StorageManager.loadJob(id);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    await SessionManager.requireJobAccess(req, job);

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
      : message.includes('Forbidden')
        ? 403
        : message.includes('Invalid job ID')
          ? 400
          : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
