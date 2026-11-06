import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobs/manager';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';
import { parseJsonBody } from '@/lib/security/request';
import { createJobSchema } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected jobs API error';
}

export async function GET(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    const limited = await rateLimit(req, { bucket: 'jobs-list', limit: 120, windowSeconds: 60, failClosed: false, discriminator: user.id });
    if (limited) return limited;
    const jobs = (await StorageManager.listJobs()).filter(j => SessionManager.canAccessJob(user, j));

    return NextResponse.json({ success: true, jobs });
  } catch (err: unknown) {
    const message = errorMessage(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Authentication required') ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
    const limited = await rateLimit(req, { bucket: 'job-create', limit: 3, windowSeconds: 300, failClosed: true, discriminator: user.id });
    if (limited) return limited;
    const body = await parseJsonBody(req, createJobSchema, 64 * 1024);
    const activeJobs = (await StorageManager.listJobs()).filter(job => job.userId === user.id && !['completed', 'failed', 'cancelled'].includes(job.status));
    if (activeJobs.length >= 2) {
      return NextResponse.json({ success: false, error: 'Finish or stop an active production before starting another.' }, { status: 429 });
    }
    const { topic, customScript, durationMinutes: dur, language, voice, contentStyle, kidsFormat, includeSubtitles, aspectRatio } = body;

    const job = await JobManager.createJob({
      topic: topic.trim(),
      customScript: typeof customScript === 'string' ? customScript.trim() : undefined,
      durationMinutes: dur,
      contentStyle,
      kidsFormat: contentStyle === 'kids' ? kidsFormat : undefined,
      includeSubtitles,
      aspectRatio,
      language,
      voice,
      userId: user.id,
    });

    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    console.error('[POST /api/jobs] Job creation error:', err);
    const message = errorMessage(err);
    const isCreditError = message.includes('Insufficient credits');
    const isAuthError = message.includes('Authentication required');
    if (!isCreditError && !isAuthError) {
      return secureErrorResponse(err, message || 'Unable to create production.');
    }
    return NextResponse.json(
      { success: false, error: message },
      { status: isCreditError ? 402 : isAuthError ? 401 : 500 }
    );
  }
}
