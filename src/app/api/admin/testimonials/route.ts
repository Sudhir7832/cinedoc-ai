import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';
import { TestimonialFormat } from '@/lib/types';
import { R2Storage } from '@/lib/storage/r2';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const MAX_VIDEO_BYTES = 90 * 1024 * 1024;
const MAX_POSTER_BYTES = 8 * 1024 * 1024;
const execAsync = promisify(exec);

function isSafeMediaUrl(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\//i.test(value);
}

export async function GET(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    return NextResponse.json({ success: true, testimonials: await TestimonialManager.list(true) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load testimonials';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Forbidden') ? 403 : 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const form = await req.formData();
    const title = String(form.get('title') || '').trim().slice(0, 100);
    const description = String(form.get('description') || '').trim().slice(0, 300);
    const quote = String(form.get('quote') || '').trim().slice(0, 500);
    const attribution = String(form.get('attribution') || '').trim().slice(0, 100);
    const format = String(form.get('format') || 'landscape') as TestimonialFormat;
    const suppliedVideoUrl = String(form.get('videoUrl') || '').trim();
    const videoFile = form.get('video');
    const posterFile = form.get('poster');

    if (!title) return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 });
    if (!['landscape', 'reels', 'tiktok'].includes(format)) {
      return NextResponse.json({ success: false, error: 'Format must be landscape, reels, or tiktok.' }, { status: 400 });
    }
    if (posterFile instanceof File && posterFile.size > 0) {
      if (posterFile.size > MAX_POSTER_BYTES) return NextResponse.json({ success: false, error: 'Poster must be smaller than 8 MB.' }, { status: 413 });
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(posterFile.type)) return NextResponse.json({ success: false, error: 'Poster must be JPG, PNG, or WebP.' }, { status: 400 });
    }

    const testimonialId = `testimonial_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    let videoUrl = suppliedVideoUrl;
    let localVideoUrl: string | undefined;
    if (videoFile instanceof File && videoFile.size > 0) {
      if (videoFile.size > MAX_VIDEO_BYTES) return NextResponse.json({ success: false, error: 'Video must be smaller than 90 MB.' }, { status: 413 });
      if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(videoFile.type)) {
        return NextResponse.json({ success: false, error: 'Video must be MP4, WebM, or MOV.' }, { status: 400 });
      }
      localVideoUrl = TestimonialManager.saveAsset(videoFile, 'video', Buffer.from(await videoFile.arrayBuffer()));
      videoUrl = localVideoUrl;
    }
    if (!videoUrl || !isSafeMediaUrl(videoUrl)) {
      return NextResponse.json({ success: false, error: 'Upload a video or provide a valid direct media URL.' }, { status: 400 });
    }

    let posterUrl: string | undefined;
    if (posterFile instanceof File && posterFile.size > 0) {
      posterUrl = TestimonialManager.saveAsset(posterFile, 'poster', Buffer.from(await posterFile.arrayBuffer()));
    } else if (localVideoUrl) {
      const localVideoPath = path.join(process.cwd(), 'public', localVideoUrl.replace(/^\//, ''));
      const posterFilename = `poster_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.jpg`;
      const posterPath = path.join(process.cwd(), 'public', 'testimonials', posterFilename);
      const dimensions = format === 'landscape' ? '960:540' : '540:960';
      await execAsync(`ffmpeg -y -ss 1 -i "${localVideoPath}" -frames:v 1 -vf "scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions}" -q:v 2 "${posterPath}"`);
      posterUrl = `/testimonials/${posterFilename}`;
    } else if (suppliedVideoUrl) {
      return NextResponse.json({ success: false, error: 'A poster image is required when using a direct video URL.' }, { status: 400 });
    }

    if (R2Storage.isConfigured() && localVideoUrl) {
      const localVideoPath = path.join(process.cwd(), 'public', localVideoUrl.replace(/^\//, ''));
      const extension = path.extname(localVideoPath).toLowerCase() || '.mp4';
      const contentType = extension === '.webm' ? 'video/webm' : extension === '.mov' ? 'video/quicktime' : 'video/mp4';
      videoUrl = (await R2Storage.uploadFile(localVideoPath, `showcase/${testimonialId}/video${extension}`, contentType)).url;
    }
    if (R2Storage.isConfigured() && posterUrl?.startsWith('/testimonials/')) {
      const localPosterPath = path.join(process.cwd(), 'public', posterUrl.replace(/^\//, ''));
      if (fs.existsSync(localPosterPath)) {
        const extension = path.extname(localPosterPath).toLowerCase() || '.jpg';
        const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
        posterUrl = (await R2Storage.uploadFile(localPosterPath, `showcase/${testimonialId}/poster${extension}`, contentType)).url;
      }
    }

    const testimonial = await TestimonialManager.create({
      id: testimonialId,
      title,
      description,
      videoUrl,
      posterUrl,
      format,
      quote: quote || undefined,
      attribution: attribution || undefined,
      published: true,
    });
    return NextResponse.json({ success: true, testimonial });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to save testimonial';
    const status = message.includes('Authentication required') ? 401 : message.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
