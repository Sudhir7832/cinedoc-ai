import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await StorageManager.loadJob(id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    await SessionManager.requireJobAccess(req, job);

    const sceneNumber = Number(req.nextUrl.searchParams.get('sceneNumber'));
    const scene = job.scenes.find(item => item.sceneNumber === sceneNumber);
    if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

    const baseName = `scene_${sceneNumber.toString().padStart(2, '0')}`;
    const requestedFilename = path.basename((scene.imagePath || '').split('?')[0]);
    const candidates = [requestedFilename, `${baseName}.jpg`, `${baseName}.png`, `${baseName}.webp`]
      .filter((value, index, list) => value && list.indexOf(value) === index)
      .filter(value => new RegExp(`^${baseName}\\.(jpg|jpeg|png|webp)$`, 'i').test(value));
    const imagesDir = StorageManager.getJobImagesDir(id);
    const filename = candidates.find(candidate => fs.existsSync(path.join(imagesDir, candidate)));
    if (!filename) return NextResponse.json({ error: 'Scene image is not available yet' }, { status: 404 });

    const buffer = fs.readFileSync(path.join(imagesDir, filename));
    let contentType = filename.toLowerCase().endsWith('.webp') ? 'image/webp' : filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) contentType = 'image/jpeg';
    if (buffer.length >= 8 && buffer.slice(1, 4).toString('ascii') === 'PNG') contentType = 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load scene image';
    const status = message.includes('Authentication required') ? 401 : message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

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

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only PNG, JPG, and WebP images are allowed.' },
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

    const relativeUrl = StorageManager.saveImageFile(id, sceneNumber, buffer);
    job.scenes[sceneIndex].imagePath = relativeUrl;
    job.scenes[sceneIndex].imageUpdatedAt = new Date().toISOString();
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
