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

export class EmailService {
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
      const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Cinedoc AI <onboarding@resend.dev>';

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
                  <tr>
                    <td style="font-size: 12px; color: #a1a1aa; padding: 4px 0;">
                      <strong>Scenes:</strong> ${job.scenes.length} Scenes
                    </td>
                    <td style="font-size: 12px; color: #a1a1aa; padding: 4px 0; text-align: right;">
                      <strong>Voice:</strong> ${job.voice} (${job.language})
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
                Cinedoc AI • Autonomous Video Studio
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                You received this email because you created a production on Cinedoc AI.
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
