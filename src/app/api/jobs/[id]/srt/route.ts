import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await StorageManager.loadJob(id);
    if (!job || !job.subtitlesPath || !fs.existsSync(job.subtitlesPath)) {
      return NextResponse.json({ success: false, error: 'Subtitles not found for this job' }, { status: 404 });
    }
    await SessionManager.requireJobAccess(req, job);

    const content = fs.readFileSync(job.subtitlesPath, 'utf-8');
    const safeTopic = (job.topic || 'documentary').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${safeTopic}_subtitles.srt`;

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/x-subrip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to download subtitles';
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
