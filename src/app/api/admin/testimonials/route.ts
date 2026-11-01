import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';
import { TestimonialFormat } from '@/lib/types';

const MAX_VIDEO_BYTES = 90 * 1024 * 1024;
const MAX_POSTER_BYTES = 8 * 1024 * 1024;

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

    let videoUrl = suppliedVideoUrl;
    if (videoFile instanceof File && videoFile.size > 0) {
      if (videoFile.size > MAX_VIDEO_BYTES) return NextResponse.json({ success: false, error: 'Video must be smaller than 90 MB.' }, { status: 413 });
      if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(videoFile.type)) {
        return NextResponse.json({ success: false, error: 'Video must be MP4, WebM, or MOV.' }, { status: 400 });
      }
      videoUrl = TestimonialManager.saveAsset(videoFile, 'video', Buffer.from(await videoFile.arrayBuffer()));
    }
    if (!videoUrl || !isSafeMediaUrl(videoUrl)) {
      return NextResponse.json({ success: false, error: 'Upload a video or provide a valid direct media URL.' }, { status: 400 });
    }

    let posterUrl: string | undefined;
    if (posterFile instanceof File && posterFile.size > 0) {
      posterUrl = TestimonialManager.saveAsset(posterFile, 'poster', Buffer.from(await posterFile.arrayBuffer()));
    }

    const testimonial = await TestimonialManager.create({
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
