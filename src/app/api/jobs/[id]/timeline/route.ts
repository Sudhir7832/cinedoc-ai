import { NextRequest, NextResponse } from 'next/server';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { SceneItem } from '@/lib/types';

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

    const body = await req.json() as { scenes?: unknown[]; includeSubtitles?: unknown };
    const { scenes, includeSubtitles } = body;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'A valid array of scenes is required.' },
        { status: 400 }
      );
    }
    if (includeSubtitles !== undefined && typeof includeSubtitles !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Subtitle preference must be true or false.' }, { status: 400 });
    }

    // Update scenes with validated fields
    job.scenes = scenes.map((value, idx: number) => {
      const scene = value as Partial<SceneItem>;
      return {
      ...scene,
      sceneNumber: idx + 1,
      audioDurationSeconds: Math.max(Number(scene.audioDurationSeconds) || 6, 2.0),
      narration: scene.narration || '',
      title: scene.title || `Scene ${idx + 1}`,
      imagePrompt: scene.imagePrompt || '',
      approxDurationSeconds: scene.approxDurationSeconds || 6,
      subtitleText: scene.subtitleText || scene.narration || '',
      imageStatus: scene.imageStatus || 'pending',
      audioStatus: scene.audioStatus || 'pending',
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
    const message = err instanceof Error ? err.message : 'Failed to update timeline';
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
