import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { parseJobId } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseJobId((await params).id);
    const job = await StorageManager.loadJob(id);
    if (!job || !job.subtitlesPath || !fs.existsSync(job.subtitlesPath)) {
      return NextResponse.json({ success: false, error: 'Subtitles not found for this job' }, { status: 404 });
    }
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-srt', limit: 60, windowSeconds: 60, failClosed: false, discriminator: user.id });
    if (limited) return limited;

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
