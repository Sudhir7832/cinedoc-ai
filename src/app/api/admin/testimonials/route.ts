import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';
import { R2Storage } from '@/lib/storage/r2';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireSameOrigin } from '@/lib/security/origin';
import { assertAllowedOutboundUrl } from '@/lib/security/outbound-url';
import { runFfmpeg } from '@/lib/security/process';
import { rateLimit } from '@/lib/security/rate-limit';
import { requireBoundedContentLength } from '@/lib/security/request';
import { testimonialFieldsSchema, bulkTestimonialsSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

const MAX_VIDEO_BYTES = 90 * 1024 * 1024;
const MAX_POSTER_BYTES = 8 * 1024 * 1024;
function isSafeMediaUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-testimonials-read', limit: 60, windowSeconds: 60, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    return NextResponse.json({ success: true, testimonials: await TestimonialManager.list(true) });
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to load testimonials.');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'admin-testimonials-write', limit: 120, windowSeconds: 600, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    requireBoundedContentLength(req, 100 * 1024 * 1024);

    const contentType = req.headers.get('content-type') || '';

    // Handle Bulk JSON Upload
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const parsed = bulkTestimonialsSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: 'Invalid bulk payload: ' + parsed.error.issues[0]?.message }, { status: 400 });
      }

      const createdItems = [];
      for (const item of parsed.data.items) {
        if (!item.videoUrl || !isSafeMediaUrl(item.videoUrl)) continue;
        const validPoster = item.posterUrl && isSafeMediaUrl(item.posterUrl) ? item.posterUrl : undefined;
        let itemTitle = (item.title || '').trim();
        if (!itemTitle) {
          try {
            const pathname = new URL(item.videoUrl).pathname;
            const name = path.basename(pathname).replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            itemTitle = name.length > 2 ? name : `Showcase Reel #${createdItems.length + 1}`;
          } catch {
            itemTitle = `Showcase Reel #${createdItems.length + 1}`;
          }
        }

        const testimonial = await TestimonialManager.create({
          id: `testimonial_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          title: itemTitle,
          description: item.description || '',
          videoUrl: item.videoUrl,
          posterUrl: validPoster,
          format: item.format,
          category: item.category,
          quote: item.quote || undefined,
          attribution: item.attribution || undefined,
          published: true,
        });
        createdItems.push(testimonial);
      }

      return NextResponse.json({ success: true, count: createdItems.length, testimonials: createdItems });
    }

    // Handle Standard Multipart Form Upload
    const form = await req.formData();
    const fields = testimonialFieldsSchema.safeParse({
      title: String(form.get('title') || ''),
      description: String(form.get('description') || ''),
      quote: String(form.get('quote') || ''),
      attribution: String(form.get('attribution') || ''),
      format: String(form.get('format') || 'landscape'),
      category: String(form.get('category') || 'documentary'),
      videoUrl: String(form.get('videoUrl') || ''),
      posterUrl: String(form.get('posterUrl') || ''),
    });
    if (!fields.success) return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    const { title, description, quote, attribution, format, category, videoUrl: suppliedVideoUrl, posterUrl: suppliedPosterUrl } = fields.data;
    const videoFile = form.get('video');
    const posterFile = form.get('poster');

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
    } else if (suppliedPosterUrl && isSafeMediaUrl(suppliedPosterUrl)) {
      posterUrl = suppliedPosterUrl;
    } else if (localVideoUrl) {
      try {
        const testimonialsDir = path.join(process.cwd(), 'public', 'testimonials');
        if (!fs.existsSync(testimonialsDir)) fs.mkdirSync(testimonialsDir, { recursive: true });
        const localVideoPath = path.join(process.cwd(), 'public', localVideoUrl.replace(/^\//, ''));
        const posterFilename = `poster_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.jpg`;
        const posterPath = path.join(testimonialsDir, posterFilename);
        const dimensions = format === 'landscape' ? '960:540' : '540:960';
        await runFfmpeg(['-y', '-ss', '1', '-i', localVideoPath, '-frames:v', '1', '-vf', `scale=${dimensions}:force_original_aspect_ratio=increase,crop=${dimensions}`, '-q:v', '2', posterPath]);
        posterUrl = `/testimonials/${posterFilename}`;
      } catch (ffmpegErr) {
        console.warn('[Admin Showcase] FFmpeg poster extraction failed, proceeding without poster:', ffmpegErr);
      }
    } else if (suppliedVideoUrl) {
      // Direct video URL without poster
      posterUrl = undefined;
    }

    if (R2Storage.isConfigured() && localVideoUrl) {
      try {
        const localVideoPath = path.join(process.cwd(), 'public', localVideoUrl.replace(/^\//, ''));
        const extension = path.extname(localVideoPath).toLowerCase() || '.mp4';
        const contentType = extension === '.webm' ? 'video/webm' : extension === '.mov' ? 'video/quicktime' : 'video/mp4';
        videoUrl = (await R2Storage.uploadFile(localVideoPath, `showcase/${testimonialId}/video${extension}`, contentType)).url;
      } catch (r2Err) {
        console.warn('[Admin Showcase] R2 upload failed, keeping local URL:', r2Err);
      }
    }
    if (R2Storage.isConfigured() && posterUrl?.startsWith('/testimonials/')) {
      try {
        const localPosterPath = path.join(process.cwd(), 'public', posterUrl.replace(/^\//, ''));
        if (fs.existsSync(localPosterPath)) {
          const extension = path.extname(localPosterPath).toLowerCase() || '.jpg';
          const contentType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
          posterUrl = (await R2Storage.uploadFile(localPosterPath, `showcase/${testimonialId}/poster${extension}`, contentType)).url;
        }
      } catch (r2Err) {
        console.warn('[Admin Showcase] R2 poster upload failed, keeping local URL:', r2Err);
      }
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      if (videoFile instanceof File && videoFile.name) {
        finalTitle = videoFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      } else if (suppliedVideoUrl) {
        try {
          const pathname = new URL(suppliedVideoUrl).pathname;
          const name = path.basename(pathname).replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          finalTitle = name.length > 2 ? name : 'Showcase Reel';
        } catch {
          finalTitle = 'Showcase Reel';
        }
      } else {
        finalTitle = 'Showcase Reel';
      }
    }

    const testimonial = await TestimonialManager.create({
      id: testimonialId,
      title: finalTitle,
      description,
      videoUrl,
      posterUrl,
      format,
      category,
      quote: quote || undefined,
      attribution: attribution || undefined,
      published: true,
    });
    return NextResponse.json({ success: true, testimonial });
  } catch (error: unknown) {
    console.error('[Admin Showcase] POST error:', error);
    const msg = error instanceof Error ? error.message : '';
    return secureErrorResponse(error, msg || 'Unable to save testimonial.');
  }
}
