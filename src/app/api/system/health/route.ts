import { NextRequest, NextResponse } from 'next/server';
import { VideoValidator } from '@/lib/video/validator';
import { getConfig } from '@/lib/config';
import { getServiceSupabase, isServerSupabaseConfigured } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'public-health', limit: 30, windowSeconds: 60, failClosed: false });
    if (limited) return limited;
    const sysCheck = await VideoValidator.checkSystemRequirements();
    const config = await getConfig();
    const { error: databaseError } = await getServiceSupabase().from('profiles').select('id', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      ffmpeg: { ffmpegAvailable: sysCheck.ffmpegAvailable },
      apiKeyConfigured: Boolean(config.openRouterApiKey),
      supabase: {
        configured: isServerSupabaseConfigured(),
        connected: !databaseError,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'System health check failed.' }, { status: 500 });
  }
}
