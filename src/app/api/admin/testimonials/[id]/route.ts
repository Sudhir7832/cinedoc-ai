import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await SessionManager.requireAdmin(req);
    const { id } = await params;
    const deleted = await TestimonialManager.delete(id);
    return NextResponse.json(
      { success: deleted, error: deleted ? undefined : 'Testimonial not found.' },
      { status: deleted ? 200 : 404 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to delete testimonial';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Forbidden') ? 403 : 401 });
  }
}
