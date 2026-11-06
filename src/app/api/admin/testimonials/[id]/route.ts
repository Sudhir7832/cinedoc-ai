import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { TestimonialManager } from '@/lib/testimonials';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { testimonialIdSchema } from '@/lib/security/schemas';
import { secureErrorResponse } from '@/lib/security/errors';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const limited = await rateLimit(req, { bucket: 'admin-testimonials-delete', limit: 20, windowSeconds: 600, failClosed: true });
    if (limited) return limited;
    await SessionManager.requireAdmin(req);
    const { id } = await params;
    if (!testimonialIdSchema.safeParse(id).success) {
      return NextResponse.json({ success: false, error: 'Invalid testimonial ID.' }, { status: 400 });
    }
    const deleted = await TestimonialManager.delete(id);
    return NextResponse.json(
      { success: deleted, error: deleted ? undefined : 'Testimonial not found.' },
      { status: deleted ? 200 : 404 }
    );
  } catch (error: unknown) {
    return secureErrorResponse(error, 'Unable to delete testimonial.');
  }
}
