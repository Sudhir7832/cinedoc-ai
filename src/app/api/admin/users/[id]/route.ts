import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await SessionManager.requireAdmin(req);
    const { id } = await params;
    const body = await req.json();

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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unable to update user' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await SessionManager.requireAdmin(req);
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unable to delete user' },
      { status: 400 }
    );
  }
}
