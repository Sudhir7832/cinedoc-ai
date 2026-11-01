import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

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

    const formData = await req.formData();
    const sceneNumberStr = formData.get('sceneNumber');
    const file = formData.get('file') as File | null;

    if (!sceneNumberStr || !file) {
      return NextResponse.json(
        { success: false, error: 'sceneNumber and file are required.' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Only image files are allowed.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image must be smaller than 15 MB.' },
        { status: 413 }
      );
    }

    const sceneNumber = parseInt(sceneNumberStr.toString(), 10);
    const sceneIndex = job.scenes.findIndex(s => s.sceneNumber === sceneNumber);
    if (sceneIndex === -1) {
      return NextResponse.json(
        { success: false, error: `Scene #${sceneNumber} not found in documentary.` },
        { status: 404 }
      );
    }

    // Convert uploaded file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save image to job's images directory as scene_XX.png
    const imagesDir = StorageManager.getJobImagesDir(id);
    const filename = `scene_${sceneNumber.toString().padStart(2, '0')}.png`;
    const fullPath = path.join(imagesDir, filename);
    fs.writeFileSync(fullPath, buffer);

    // Append cache-busting timestamp query parameter so browsers reload the image
    const relativeUrl = `/generated/${id}/images/${filename}?t=${Date.now()}`;
    job.scenes[sceneIndex].imagePath = relativeUrl;
    job.scenes[sceneIndex].imageStatus = 'completed';
    job.scenes[sceneIndex].error = undefined;

    await StorageManager.saveJob(job);

    return NextResponse.json({
      success: true,
      message: `Scene #${sceneNumber} image replaced successfully!`,
      sceneNumber,
      imagePath: relativeUrl,
      job,
    });
  } catch (err: unknown) {
    console.error('[Scene Image Upload Error]:', err);
    const message = err instanceof Error ? err.message : 'Failed to upload scene image';
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
