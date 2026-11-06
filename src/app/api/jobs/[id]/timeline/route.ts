import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { SceneItem } from '@/lib/types';
import { parseJsonBody } from '@/lib/security/request';
import { parseJobId, timelineUpdateSchema } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

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
    const limited = await rateLimit(req, { bucket: 'job-timeline', limit: 20, windowSeconds: 600, failClosed: true, discriminator: user.id });
    if (limited) return limited;

    const body = await parseJsonBody(req, timelineUpdateSchema, 256 * 1024);
    const { scenes, includeSubtitles } = body;
    if (scenes.length !== job.scenes.length || scenes.length > job.durationMinutes * 10) {
      return NextResponse.json({ success: false, error: 'Scene count cannot be changed from the approved production plan.' }, { status: 400 });
    }

    // Update scenes with validated fields
    job.scenes = scenes.map((value, idx: number) => {
      const scene = value as Partial<SceneItem>;
      const existing = job.scenes[idx];
      return {
        ...existing,
        sceneNumber: idx + 1,
        narration: scene.narration || '',
        title: scene.title || `Scene ${idx + 1}`,
        imagePrompt: scene.imagePrompt || '',
        approxDurationSeconds: scene.approxDurationSeconds || 6,
        subtitleText: scene.subtitleText || scene.narration || '',
      };
    });
    if (typeof includeSubtitles === 'boolean') job.includeSubtitles = includeSubtitles;

    await StorageManager.saveJob(job);

    return NextResponse.json({
      success: true,
      message: 'Timeline updated successfully.',
      job,
    });
  } catch (err: unknown) {
    console.error('[Timeline Update Error]:', err);
    return secureErrorResponse(err, 'Failed to update timeline.');
  }
}
