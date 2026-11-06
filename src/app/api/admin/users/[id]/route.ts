import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { parseJsonBody } from '@/lib/security/request';
import { adminUpdateUserSchema } from '@/lib/security/schemas';
import { rateLimit } from '@/lib/security/rate-limit';
import { secureErrorResponse } from '@/lib/security/errors';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await SessionManager.requireAdmin(req);
    const limited = await rateLimit(req, { bucket: 'admin-user-update', limit: 60, windowSeconds: 3600, failClosed: true, discriminator: admin.id });
    if (limited) return limited;
    const { id } = await params;
    const body = await parseJsonBody(req, adminUpdateUserSchema, 8 * 1024);

    const { deltaCredits, role, name, email } = body;

    if (admin.id === id && role && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Cannot remove admin role from your own account' },
        { status: 400 }
      );
    }

    let updated;
    if (typeof deltaCredits === 'number') {
      updated = await DbManager.adjustCredits(id, deltaCredits);
    } else {
      updated = await DbManager.updateUser(id, { role, name, email });
    }

    return NextResponse.json({ success: true, user: updated });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to update user.');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await SessionManager.requireAdmin(req);
    const limited = await rateLimit(req, { bucket: 'admin-user-delete', limit: 20, windowSeconds: 3600, failClosed: true, discriminator: admin.id });
    if (limited) return limited;
    const { id } = await params;

    if (admin.id === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own admin account' },
        { status: 400 }
      );
    }

    const deleted = await DbManager.deleteUser(id);
    return NextResponse.json({ success: deleted });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to delete user.');
  }
}
