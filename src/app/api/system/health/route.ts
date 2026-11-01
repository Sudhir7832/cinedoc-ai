import { NextResponse } from 'next/server';
import { VideoValidator } from '@/lib/video/validator';
import { getConfig } from '@/lib/config';

export async function GET() {
  try {
    const sysCheck = await VideoValidator.checkSystemRequirements();
    const config = await getConfig();

    return NextResponse.json({
      success: true,
      ffmpeg: sysCheck,
      apiKeyConfigured: Boolean(config.openRouterApiKey),
      models: {
        text: config.textModel,
        image: config.imageModel,
        tts: config.ttsModel,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
