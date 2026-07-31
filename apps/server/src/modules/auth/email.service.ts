import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * No RESEND_API_KEY configured → log the email instead of sending it. This is deliberate, not a
 * fallback for errors: it keeps self-hosted/dev deployments fully functional (an operator can
 * read the verification/reset link straight from the server log) without requiring anyone to set
 * up email infrastructure just to run OpenOTA.
 */
async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!env.resendApiKey) {
    logger.info({ to, subject, html }, "RESEND_API_KEY not set — logging email instead of sending");
    return;
  }

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
    logger.error({ status: response.status, body }, "Failed to send email via Resend");
    throw new Error("Failed to send email");
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
