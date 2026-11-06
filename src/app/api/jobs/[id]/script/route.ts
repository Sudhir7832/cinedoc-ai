import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { JobManager } from '@/lib/jobs/manager';
import { parseJsonBody } from '@/lib/security/request';
import { parseJobId, scriptUpdateSchema } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseJobId((await params).id);
    const job = await StorageManager.loadJob(id);
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    const user = await SessionManager.requireJobAccess(req, job);
    const limited = await rateLimit(req, { bucket: 'job-script', limit: 20, windowSeconds: 600, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    if (job.status !== 'reviewing_script') {
      return NextResponse.json({ success: false, error: 'This script is no longer editable.' }, { status: 409 });
    }
    const body = await parseJsonBody(req, scriptUpdateSchema, 256 * 1024);
    const expectedScenes = job.durationMinutes * 10;
    if (body.scenes.length !== expectedScenes) {
      return NextResponse.json({ success: false, error: `This production requires exactly ${expectedScenes} scenes.` }, { status: 400 });
    }

    job.scriptSummary = String(body.summary || job.scriptSummary || '').trim();
    job.scenes = body.scenes.map((scene, index) => ({
      sceneNumber: index + 1,
      title: scene.title,
      narration: scene.narration,
      imagePrompt: scene.imagePrompt,
      approxDurationSeconds: scene.approxDurationSeconds,
      subtitleText: scene.subtitleText || scene.narration,
      imageStatus: 'pending',
      audioStatus: 'pending',
    }));
    if (job.scenes.some(scene => !scene.narration || !scene.imagePrompt)) return NextResponse.json({ success: false, error: 'Every scene needs narration and an image prompt.' }, { status: 400 });
    await StorageManager.saveJob(job);

    const updated = body.approve ? await JobManager.approveScript(id) : job;
    return NextResponse.json({ success: true, job: updated, message: body.approve ? 'Script approved. Production is continuing.' : 'Script draft saved.' });
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to update script.');
  }
}
