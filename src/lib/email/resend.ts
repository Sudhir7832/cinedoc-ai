import { Resend } from 'resend';
import { DocumentaryJob } from '../types';
import { DbManager } from '../db';

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMessageToHtml(rawText: string): string {
  const paragraphs = rawText.split(/\r?\n\r?\n/);
  return paragraphs
    .map(p => {
      const lines = p.split(/\r?\n/).map(line => escapeHtml(line)).join('<br />');
      return `<p style="margin: 0 0 16px 0; font-size: 15px; color: #d4d4d8; line-height: 1.6;">${lines}</p>`;
    })
    .join('');
}

export interface CustomEmailParams {
  to: string[];
  subject: string;
  heading?: string;
  badge?: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}

export class EmailService {
  public static getSenderConfig(): {
    configured: boolean;
    fromEmail: string;
    isCustomDomain: boolean;
  } {
    const configured = Boolean(process.env.RESEND_API_KEY?.trim());
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'KinesisFlow <onboarding@resend.dev>';
    const isCustomDomain = !fromEmail.toLowerCase().includes('@resend.dev');
    return {
      configured,
      fromEmail,
      isCustomDomain,
    };
  }

  public static async sendCustomEmail(params: CustomEmailParams): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
    errors?: string[];
  }> {
    const resend = getResendClient();
    if (!resend) {
      return { success: false, sentCount: 0, failedCount: params.to.length, errors: ['RESEND_API_KEY is not configured in .env.local'] };
    }

    const { fromEmail } = this.getSenderConfig();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');
    const badgeText = escapeHtml(params.badge || 'Official Notification');
    const headingText = escapeHtml(params.heading || params.subject);
    const bodyHtml = formatMessageToHtml(params.message);

    let ctaButtonHtml = '';
    if (params.buttonText && params.buttonUrl) {
      const safeUrl = params.buttonUrl.trim();
      const safeLabel = escapeHtml(params.buttonText.trim());
      ctaButtonHtml = `
        <tr>
          <td align="center" style="padding: 24px 36px 12px 36px;">
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);">
                  <a href="${safeUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.02em;">
                    ${safeLabel}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090a0f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #12131a; border-radius: 20px; border: 1px solid #27272a; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
          <!-- Top Accent Banner -->
          <tr>
            <td style="background: linear-gradient(90deg, #f59e0b, #ea580c, #f43f5e); height: 6px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 16px 36px;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px;">
                      ${badgeText}
                    </span>
                    <h1 style="margin: 14px 0 6px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
                      ${headingText}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 10px 36px 20px 36px;">
              <div style="background-color: #181924; border: 1px solid #2e2f3e; border-radius: 14px; padding: 22px;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          ${ctaButtonHtml}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 30px 36px; border-top: 1px solid #20212c; background-color: #0e0f15; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #a1a1aa; letter-spacing: -0.01em;">
                KinesisFlow • AI Video Workspace
              </p>
              <p style="margin: 0; font-size: 11px; color: #71717a;">
                You received this email as a registered user of <a href="${siteUrl}" style="color: #ea580c; text-decoration: none;">KinesisFlow</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const recipients = Array.from(new Set(params.to.map(e => e.trim().toLowerCase()))).filter(Boolean);
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Process recipients in small batches with rate limiting protection
    const batchSize = 3;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async recipient => {
          return resend.emails.send({
            from: fromEmail,
            to: recipient,
            subject: params.subject,
            html,
          });
        })
      );

      for (let j = 0; j < results.length; j++) {
        const res = results[j];
        if (res.status === 'fulfilled') {
          sentCount++;
        } else {
          failedCount++;
          const errReason = res.reason instanceof Error ? res.reason.message : String(res.reason);
          errors.push(`${batch[j]}: ${errReason}`);
          console.warn(`[EmailService] Failed to send to ${batch[j]}:`, errReason);
        }
      }

      if (i + batchSize < recipients.length) {
        await new Promise(r => setTimeout(r, 600)); // Respect Resend rate limits
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
      failedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };
  }

  public static async sendVideoCompletedEmail(
    job: DocumentaryJob,
    isRerender = false
  ): Promise<{ success: boolean; reason?: string }> {
    const resend = getResendClient();
    if (!resend) {
      console.log('[EmailService] RESEND_API_KEY is not configured. Skipping video completion email.');
      return { success: false, reason: 'unconfigured' };
    }

    if (!job.userId) {
      return { success: false, reason: 'no_user_id' };
    }

    try {
      const user = await DbManager.getUserById(job.userId);
      if (!user?.email) {
        console.warn(`[EmailService] No email found for user ID: ${job.userId}`);
        return { success: false, reason: 'no_email' };
      }

      const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
        .split(',')[0]
        .trim()
        .replace(/\/+$/, '');
      const watchUrl = `${configuredSiteUrl}/?jobId=${encodeURIComponent(job.id)}`;
      const { fromEmail } = this.getSenderConfig();

      const actionText = isRerender ? 'Re-rendered & Ready' : 'Production Completed';
      const styleLabel = job.contentStyle === 'kids'
        ? `Kids ${job.kidsFormat || 'Story'}`
        : 'Cinematic Documentary';

      // Pick thumbnail preview URL if valid http(s)
      let thumbImgHtml = '';
      if (job.thumbnailUrl && (job.thumbnailUrl.startsWith('http://') || job.thumbnailUrl.startsWith('https://'))) {
        thumbImgHtml = `
          <div style="margin: 20px 0; border-radius: 12px; overflow: hidden; border: 1px solid #27272a;">
            <img src="${job.thumbnailUrl}" alt="Video Thumbnail" style="width: 100%; max-height: 320px; object-fit: cover; display: block;" />
          </div>
        `;
      }

      const subject = isRerender
        ? `🎬 Your re-rendered video is ready: "${job.topic}"`
        : `🎉 Your video is ready to watch: "${job.topic}" (1080p HD)`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090a0f; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #12131a; border-radius: 20px; border: 1px solid #27272a; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
          <!-- Top Accent Banner -->
          <tr>
            <td style="background: linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6); height: 6px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px 36px;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 9999px;">
                      ${actionText}
                    </span>
                    <h1 style="margin: 14px 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                      Your 1080p Video is Ready!
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: #a1a1aa; line-height: 1.5;">
                      Sit back, relax, and watch your video. All animation, AI narration, and Ken Burns visuals have finished rendering.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Video Details Card -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="background-color: #181924; border: 1px solid #2e2f3e; border-radius: 14px; padding: 20px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa;">
                  Production Topic
                </p>
                <h3 style="margin: 0 0 14px 0; font-size: 17px; font-weight: 700; color: #ffffff; line-height: 1.4;">
                  ${job.topic}
                </h3>

                <table role="presentation" width="100%" style="border-top: 1px solid #272738; padding-top: 12px;">
                  <tr>
                    <td style="font-size: 12px; color: #a1a1aa; padding: 4px 0;">
                      <strong>Format:</strong> ${job.durationMinutes} min • ${job.aspectRatio || '16:9'}
                    </td>
                    <td style="font-size: 12px; color: #a1a1aa; padding: 4px 0; text-align: right;">
                      <strong>Style:</strong> ${styleLabel}
                    </td>
                  </tr>
                </table>
              </div>

              ${thumbImgHtml}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 26px 36px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);">
                    <a href="${watchUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.02em;">
                      ▶ Watch &amp; Download Video
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 16px 0 0 0; font-size: 11px; color: #71717a;">
                💡 <strong>Tip:</strong> 2 YouTube thumbnails (16:9 HD) were also created for this video. You can select your favorite thumbnail directly inside the studio.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px 30px 36px; border-top: 1px solid #20212c; background-color: #0e0f15; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #71717a;">
                KinesisFlow • AI Video Studio
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                You received this email because you created a production on KinesisFlow.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const response = await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject,
        html,
      });

      console.log(`[EmailService] Video completion email sent to ${user.email} (Message ID: ${response.data?.id || 'ok'})`);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[EmailService] Failed to send completion email via Resend: ${msg}`);
      return { success: false, reason: msg };
    }
  }
}
