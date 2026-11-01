import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const [settings, user] = await Promise.all([DbManager.getSettings(), SessionManager.getCurrentUser(req)]);
    return NextResponse.json({
      authenticated: Boolean(user),
      user,
      settings: { enableTestMode: settings.enableTestMode, creditsPerScene: settings.creditsPerScene, welcomeCredits: settings.welcomeCredits },
    });
  } catch (error: unknown) {
    return NextResponse.json({ authenticated: false, error: error instanceof Error ? error.message : 'Authentication lookup failed' }, { status: 500 });
  }
}
