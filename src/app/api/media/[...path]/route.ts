import { NextRequest, NextResponse } from 'next/server';
import { R2Storage } from '@/lib/storage/r2';
import { Readable } from 'stream';

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
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    const status = rangeHeader && data.ContentRange ? 206 : 200;
    return new NextResponse(webStream, { status, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Media stream error';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

