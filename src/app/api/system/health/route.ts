import { NextResponse } from 'next/server';
import { VideoValidator } from '@/lib/video/validator';
import { getConfig } from '@/lib/config';
import { getServiceSupabase, isServerSupabaseConfigured } from '@/lib/supabase/server';

export async function GET() {
  try {
    const sysCheck = await VideoValidator.checkSystemRequirements();
    const config = await getConfig();
    const { error: databaseError } = await getServiceSupabase().from('profiles').select('id', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      ffmpeg: sysCheck,
      apiKeyConfigured: Boolean(config.openRouterApiKey),
      supabase: {
        configured: isServerSupabaseConfigured(),
        connected: !databaseError,
        error: databaseError?.message,
      },
      models: {
        text: config.textModel,
        image: config.imageModel,
        tts: config.ttsModel,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'System health check failed' }, { status: 500 });
  }
}
