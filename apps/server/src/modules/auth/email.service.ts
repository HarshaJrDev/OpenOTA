import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getEmailTestMode } from "../admin/service.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Lazily built and memoized — one long-lived pooled connection, not a new SMTP handshake per
// email. Only ever constructed when SMTP is actually the active transport (see sendEmail below),
// so an operator using Resend (or neither) never pays for this.
let smtpTransport: Transporter | undefined;
function getSmtpTransport(): Transporter {
  smtpTransport ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return smtpTransport;
}

function isSmtpConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

/**
 * Transport precedence: Resend (if RESEND_API_KEY set) → SMTP (if all four SMTP_* vars set, e.g.
 * Gmail + an App Password) → log-only. Resend stays first because it's zero-setup for anyone who
 * signs up for a key; SMTP exists for operators who'd rather reuse an email account they already
 * have. Neither is required — the admin-controlled "email test mode" toggle (default ON — see
 * admin/service.ts) and the log-only fallback below both exist so self-hosted/dev/testing-stage
 * deployments stay fully functional with zero email infrastructure: an operator can always read
 * the verification/reset link straight from the server log.
 *
 * A *configured* transport that fails to actually send (revoked key/password, unverified sending
 * domain, provider outage, ...) is deliberately non-fatal for the same reason: signup/login/
 * resend/forgot-password must keep working even when transactional email is broken, since the
 * account itself doesn't depend on email deliverability (self-hosted operators can still read the
 * link from this log line). This previously threw for Resend, which turned a Resend-side failure
 * into a 500 on `/auth/signup` and `/auth/verify-email/resend` for every user, not just an unsent
 * email — see the incident that fixed. SMTP follows the same non-fatal contract.
 */
async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!env.resendApiKey && !isSmtpConfigured()) {
    logger.info({ to, subject, html }, "No email transport configured — logging email instead of sending");
    return;
  }

  if (await getEmailTestMode()) {
    logger.info({ to, subject, html }, "Email test mode is ON (admin setting) — logging email instead of sending");
    return;
  }

  if (env.resendApiKey) {
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
    return;
  }

  try {
    await getSmtpTransport().sendMail({ from: env.emailFrom, to, subject, html });
  } catch (error) {
    // Never log SMTP_PASS — this catches the transport's own error object, not credentials.
    logger.error(
      { to, subject, err: error },
      "Failed to send email via SMTP — continuing without blocking the caller. Check SMTP_HOST/PORT/USER/PASS and SMTP_SECURE.",
    );
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
