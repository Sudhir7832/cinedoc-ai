import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { adminCreateUserSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-users-read', limit: 60, windowSeconds: 60, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const users = (await DbManager.getUsers()).map(user => DbManager.toSafeUser(user));
    return NextResponse.json({ success: true, users });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to load users.');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'admin-users-create', limit: 10, windowSeconds: 600, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const { email, password, name, role } = await parseJsonBody(req, adminCreateUserSchema, 8 * 1024);

    const user = await DbManager.createUser({ email, password, name, role });
    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to create user.');
  }
}
