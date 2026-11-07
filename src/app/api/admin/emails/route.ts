import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/lib/auth/session';
import { DbManager } from '@/lib/db';
import { EmailService } from '@/lib/email/resend';
import { requireSameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { parseJsonBody } from '@/lib/security/request';
import { secureErrorResponse } from '@/lib/security/errors';
import { z } from 'zod';

const sendAdminEmailSchema = z.object({
  targetType: z.enum(['single', 'all', 'test']),
  recipientEmail: z.string().email().optional(),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters.').max(200),
  heading: z.string().trim().max(200).optional(),
  badge: z.string().trim().max(60).optional(),
  message: z.string().trim().min(5, 'Message must be at least 5 characters.').max(10000),
  buttonText: z.string().trim().max(80).optional(),
  buttonUrl: z.string().trim().url('Action URL must be a valid http/https URL.').max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit(req, { bucket: 'admin-email-read', limit: 60, windowSeconds: 60, failClosed: true });
    if (limited) return limited;

    await SessionManager.requireAdmin(req);
    const sender = EmailService.getSenderConfig();
    const users = await DbManager.getUsers();
    const userEmails = users.map(u => ({ id: u.id, name: u.name, email: u.email })).filter(u => Boolean(u.email));

    return NextResponse.json({
      success: true,
      sender,
      totalUsers: userEmails.length,
      users: userEmails.slice(0, 500),
    });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to load email configuration.');
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const admin = await SessionManager.requireAdmin(req);

    const limited = await rateLimit(req, {
      bucket: 'admin-email-send',
      limit: 30,
      windowSeconds: 300,
      failClosed: true,
      discriminator: admin.id,
    });
    if (limited) return limited;

    const body = await parseJsonBody(req, sendAdminEmailSchema, 64 * 1024);

    let recipients: string[] = [];

    if (body.targetType === 'test') {
      if (!admin.email) {
        return NextResponse.json({ success: false, error: 'Your admin account has no email address configured.' }, { status: 400 });
      }
      recipients = [admin.email];
    } else if (body.targetType === 'single') {
      if (!body.recipientEmail) {
        return NextResponse.json({ success: false, error: 'Recipient email address is required.' }, { status: 400 });
      }
      recipients = [body.recipientEmail.trim().toLowerCase()];
    } else if (body.targetType === 'all') {
      const users = await DbManager.getUsers();
      recipients = users
        .map(u => u.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email && email.includes('@')));
      recipients = Array.from(new Set(recipients));

      if (recipients.length === 0) {
        return NextResponse.json({ success: false, error: 'No registered user emails found to broadcast to.' }, { status: 400 });
      }
    }

    const result = await EmailService.sendCustomEmail({
      to: recipients,
      subject: body.subject,
      heading: body.heading || body.subject,
      badge: body.badge || (body.targetType === 'test' ? 'TEST PREVIEW' : 'OFFICIAL UPDATE'),
      message: body.message,
      buttonText: body.buttonText,
      buttonUrl: body.buttonUrl,
    });

    if (!result.success && result.sentCount === 0) {
      return NextResponse.json({
        success: false,
        error: result.errors?.[0] || 'Failed to dispatch email via Resend.',
        sentCount: 0,
        failedCount: result.failedCount,
      }, { status: 500 });
    }

    const targetDesc = body.targetType === 'test'
      ? `test email sent to ${admin.email}`
      : body.targetType === 'single'
        ? `email sent to ${body.recipientEmail}`
        : `broadcast email dispatched to ${result.sentCount} user(s)`;

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      totalTargeted: recipients.length,
      errors: result.errors,
      message: `Successfully completed: ${targetDesc}.`,
    });
  } catch (err: unknown) {
    return secureErrorResponse(err, 'Unable to send email.');
  }
}

