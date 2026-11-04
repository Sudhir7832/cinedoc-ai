import { NextResponse } from 'next/server';
import { DbManager } from '@/lib/db';
import { SCENES_PER_MINUTE } from '@/lib/credits';
import { connection } from 'next/server';

export async function GET() {
  try {
    await connection();
    const settings = await DbManager.getSettings();
    return NextResponse.json({
      success: true,
      packs: settings.pricingPacks,
      enableTestMode: settings.enableTestMode,
      creditsPerScene: settings.creditsPerScene,
      creditsPerMinute: settings.creditsPerScene * SCENES_PER_MINUTE,
      welcomeCredits: settings.welcomeCredits,
      stripeEnabled: settings.enableStripe,
      stripeAvailable: Boolean(settings.enableStripe && settings.stripePublishableKey && settings.stripeSecretKey),
      stripePublishableKey: settings.stripePublishableKey,
      razorpayEnabled: settings.enableRazorpay,
      razorpayAvailable: Boolean(settings.enableRazorpay && settings.razorpayKeyId && settings.razorpayKeySecret),
      razorpayKeyId: settings.razorpayKeyId,
      dodoEnabled: settings.enableDodo,
      dodoAvailable: Boolean(settings.enableDodo && settings.dodoApiKey && settings.pricingPacks.some(pack => pack.dodoProductId)),
      dodoMode: settings.dodoMode,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load pricing packs';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
