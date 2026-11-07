import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { parseJobId } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { z } from 'zod';

const updateThumbnailSchema = z.object({
  thumbnailUrl: z.string().min(1).max(2000),
});

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
    const limited = await rateLimit(req, { bucket: 'job-thumbnail', limit: 30, windowSeconds: 60, failClosed: true, discriminator: user.id });
    if (limited) return limited;

    const body = await parseJsonBody(req, updateThumbnailSchema, 8 * 1024);
    const { thumbnailUrl } = body;

    job.thumbnailUrl = thumbnailUrl;

    // If it's a local media thumbnail, update thumbnail.jpg on disk
    try {
      const jobDir = StorageManager.getPublicJobDir(id);
      const match = thumbnailUrl.match(/thumbnail_(\d+)\.jpg/);
      if (match) {
        const sourceFile = path.join(jobDir, `thumbnail_${match[1]}.jpg`);
        const targetFile = path.join(jobDir, 'thumbnail.jpg');
        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, targetFile);
          job.thumbnailPath = targetFile;
        }
      }
    } catch (diskErr) {
      console.warn('[Thumbnail update disk copy warning]:', diskErr);
    }

    await StorageManager.saveJob(job);

    return NextResponse.json({
      success: true,
      thumbnailUrl: job.thumbnailUrl,
      message: 'YouTube thumbnail updated successfully.',
    });
  } catch (err: unknown) {
    console.error('[Update Thumbnail Error]:', err);
    const message = err instanceof Error ? err.message : 'Failed to update thumbnail';
    const status = message.includes('Authentication required') ? 401 : message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

