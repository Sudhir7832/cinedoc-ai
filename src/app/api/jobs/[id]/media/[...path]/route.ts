import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { parseJobId } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';

const ALLOWED_MEDIA = /^(?:documentary\.mp4|thumbnail(?:_\d+)?\.jpg|subtitles\.srt|images\/scene_\d{2}\.(?:png|jpe?g|webp)|audio\/(?:scene_\d{2}|rhyme_music|narration_master)\.mp3)$/i;

function contentTypeFor(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.srt') return 'application/x-subrip; charset=utf-8';
  return 'application/octet-stream';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  try {
    const resolved = await params;
    const id = parseJobId(resolved.id);
    const job = await StorageManager.loadJob(id);
    if (!job) return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-media', limit: 300, windowSeconds: 60, failClosed: false, discriminator: user.id });
    if (limited) return limited;

    const relativePath = (resolved.path || []).join('/');
    if (!ALLOWED_MEDIA.test(relativePath)) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }
    const jobDir = StorageManager.getPublicJobDir(id);
    const filePath = path.resolve(jobDir, ...relativePath.split('/'));
    if (!filePath.startsWith(path.resolve(jobDir) + path.sep) || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    const range = req.headers.get('range');
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
      start = match[1] ? Number(match[1]) : 0;
      end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= stat.size) {
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
      }
      status = 206;
    }

    const nodeStream = fs.createReadStream(filePath, { start, end });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', chunk => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', error => controller.error(error));
      },
      cancel() {
        nodeStream.destroy();
      },
    });
    const length = end - start + 1;
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Length': String(length),
      'Content-Type': contentTypeFor(filePath),
      'X-Content-Type-Options': 'nosniff',
    });
    if (status === 206) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    return new NextResponse(body, { status, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('Authentication required') ? 401 : message.includes('Forbidden') ? 403 : 404;
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : status === 403 ? 'Forbidden.' : 'Media not found.' }, { status });
  }
}
