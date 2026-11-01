import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { StorageManager } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    await SessionManager.requireAdmin(req);
    const jobs = await StorageManager.listJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message?.includes('Forbidden') ? 403 : 401 }
    );
  }
}
