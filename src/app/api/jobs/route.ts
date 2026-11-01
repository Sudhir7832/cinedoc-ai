import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobs/manager';
import { StorageManager } from '@/lib/storage';
import { SessionManager } from '@/lib/auth/session';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected jobs API error';
}

export async function GET(req: NextRequest) {
  try {
    const user = await SessionManager.requireAuth(req);
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
    const body = await req.json();
    const { topic, customScript, durationMinutes = 1, language, voice = 'alloy', contentStyle = 'documentary', kidsFormat = 'entertainment', includeSubtitles = true, aspectRatio = '16:9' } = body;

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ success: false, error: 'Documentary topic or title is required.' }, { status: 400 });
    }

    const dur = Number(durationMinutes) as 1 | 3 | 5;
    if (![1, 3, 5].includes(dur)) {
      return NextResponse.json({ success: false, error: 'Duration must be 1, 3, or 5 minutes.' }, { status: 400 });
    }
    if (!['documentary', 'kids'].includes(contentStyle)) {
      return NextResponse.json({ success: false, error: 'Content style must be documentary or kids.' }, { status: 400 });
    }
    if (contentStyle === 'kids' && !['educational', 'entertainment', 'adventure', 'bedtime'].includes(kidsFormat)) {
      return NextResponse.json({ success: false, error: 'Kids format must be educational, entertainment, adventure, or bedtime.' }, { status: 400 });
    }
    if (typeof includeSubtitles !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Subtitle preference must be true or false.' }, { status: 400 });
    }
    if (!['16:9', '9:16'].includes(aspectRatio)) {
      return NextResponse.json({ success: false, error: 'Aspect ratio must be 16:9 or 9:16.' }, { status: 400 });
    }
    if (aspectRatio === '9:16' && dur !== 1) {
      return NextResponse.json({ success: false, error: 'Vertical 9:16 output is available for 1-minute videos.' }, { status: 400 });
    }

    const job = await JobManager.createJob({
      topic: topic.trim(),
      customScript: typeof customScript === 'string' ? customScript.trim() : undefined,
      durationMinutes: dur,
      contentStyle,
      kidsFormat: contentStyle === 'kids' ? kidsFormat : undefined,
      includeSubtitles,
      aspectRatio,
      language: language || undefined,
      voice,
      userId: user.id,
    });

    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    const message = errorMessage(err);
    const isCreditError = message.includes('Insufficient credits');
    const isAuthError = message.includes('Authentication required');
    return NextResponse.json(
      { success: false, error: message },
      { status: isCreditError ? 402 : isAuthError ? 401 : 500 }
    );
  }
}
