import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getEmailTestMode } from "../admin/service.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * No RESEND_API_KEY configured, OR the admin-controlled "email test mode" setting is on (the
 * default — see admin/service.ts and db/client.ts's schema comment on the `settings` table) → log
 * the email instead of sending it. This is deliberate, not a fallback for errors: it keeps
 * self-hosted/dev/testing-stage deployments fully functional (an operator can read the
 * verification/reset link straight from the server log) without requiring anyone to set up real
 * email infrastructure, and lets an admin flip real sending on/off from the dashboard without a
 * redeploy once they're ready to email real users.
 *
 * A *configured* key that fails to actually send (revoked key, unverified sending domain, Resend
 * outage, ...) is deliberately non-fatal too, for the same reason: signup/login/resend/forgot-
 * password must keep working even when transactional email is broken, since the account itself
 * doesn't depend on email deliverability (self-hosted operators can still read the link from this
 * log line, same as the no-key/test-mode path). This previously threw, which turned a Resend-side
 * failure into a 500 on `/auth/signup` and `/auth/verify-email/resend` for every user, not just an
 * unsent email — see the incident this comment is fixing.
 */
async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!env.resendApiKey) {
    logger.info({ to, subject, html }, "RESEND_API_KEY not set — logging email instead of sending");
    return;
  }

  if (await getEmailTestMode()) {
    logger.info({ to, subject, html }, "Email test mode is ON (admin setting) — logging email instead of sending");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        { to, subject, status: response.status, body },
        "Failed to send email via Resend — continuing without blocking the caller. Check RESEND_API_KEY validity and that EMAIL_FROM's domain is verified in Resend.",
      );
    }
  } catch (error) {
    logger.error({ to, subject, err: error }, "Failed to reach Resend — continuing without blocking the caller");
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.dashboardUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Verify your OpenOTA email",
    html: `<p>Confirm your email to finish setting up your OpenOTA account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${env.dashboardUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Reset your OpenOTA password",
    html: `<p>Someone requested a password reset for this OpenOTA account.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.</p>`,
  });
}
