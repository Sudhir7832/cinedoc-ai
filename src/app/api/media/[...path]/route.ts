import { NextRequest, NextResponse } from 'next/server';
import { R2Storage } from '@/lib/storage/r2';
import { Readable } from 'stream';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathParts = resolvedParams.path || [];

    if (!pathParts.length) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const key = pathParts.join('/');
    const isJobAsset = pathParts[0] === 'jobs' && Boolean(pathParts[1]);
    const isShowcaseAsset = pathParts[0] === 'showcase';

    if (isJobAsset) {
      const job = await StorageManager.loadJob(pathParts[1]);
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      await SessionManager.requireJobAccess(req, job);
      if (job.mediaToken && pathParts[2] !== job.mediaToken) {
        return NextResponse.json({ error: 'Invalid private media token' }, { status: 403 });
      }
    } else if (isShowcaseAsset) {
      const publicUrl = `/api/media/${key}`;
      const published = (await TestimonialManager.list(false)).some(item => item.videoUrl === publicUrl || item.posterUrl === publicUrl);
      if (!published) return NextResponse.json({ error: 'Showcase media not found' }, { status: 404 });
    } else {
      return NextResponse.json({ error: 'Media access denied' }, { status: 403 });
    }
    const rangeHeader = req.headers.get('range') || undefined;

    const data = await R2Storage.getFileStream(key, rangeHeader);

    if (!data.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const nodeStream = data.Body as Readable;
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    const headers = new Headers();
    if (data.ContentType) headers.set('Content-Type', data.ContentType);
    if (data.ContentLength !== undefined)
      headers.set('Content-Length', data.ContentLength.toString());
    if (data.ContentRange) headers.set('Content-Range', data.ContentRange);
    headers.set('Accept-Ranges', data.AcceptRanges || 'bytes');
    headers.set('Cache-Control', isShowcaseAsset ? 'public, max-age=86400' : 'private, no-store, max-age=0');

    const status = rangeHeader && data.ContentRange ? 206 : 200;
    return new NextResponse(webStream, { status, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Media stream error';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
