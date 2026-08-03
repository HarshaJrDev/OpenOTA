import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { authRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import { getEmailTestMode } from "../admin/service.js";
import { setSessionCookie, clearSessionCookie } from "./cookie.js";
import { buildAuthorizationUrl, exchangeCodeForProfile, verifyState } from "./google.js";
import * as authService from "./service.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const emailSchema = z.object({ email: z.string().email() });
const tokenSchema = z.object({ token: z.string().min(1) });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

export const authRouter: ExpressRouter = Router();

authRouter.post("/signup", authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = await authService.signup(email, password);
    setSessionCookie(res, token); // same-origin / self-hosted
    // token is ALSO returned so a cross-domain dashboard can send it as a Bearer header, which
    // works even when the browser blocks the third-party session cookie. See session.middleware.
    sendSuccess(res, { userId, token }, 201);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = await authService.login(email, password);
    setSessionCookie(res, token); // same-origin / self-hosted
    sendSuccess(res, { userId, token }); // token for cross-domain Bearer auth (see signup)
  } catch (error) {
    next(error);
  }
});

// GET, not POST — this must be a real browser navigation (Google's own login page has to load in
// the top-level window), never a fetch() call like every other route above.
authRouter.get("/google", authRateLimiter, (_req, res) => {
  try {
    res.redirect(buildAuthorizationUrl());
  } catch {
    res.redirect(`${env.dashboardUrl}/login?error=google_not_configured`);
  }
});

authRouter.get("/google/callback", authRateLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    if (typeof code !== "string" || !verifyState(typeof state === "string" ? state : undefined)) {
      throw new Error("invalid code or state");
    }

    const profile = await exchangeCodeForProfile(code);
    const { token } = await authService.signInWithGoogle(profile);
    // Fragment, not a query string: never sent to any server (including the dashboard's own
    // Next.js server) or logged anywhere — only client-side JS on that page can read it. See
    // apps/dashboard/src/app/auth/callback/page.tsx.
    res.redirect(`${env.dashboardUrl}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch {
    res.redirect(`${env.dashboardUrl}/login?error=google_auth_failed`);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  sendSuccess(res, { loggedOut: true });
});

authRouter.get("/me", requireSession, async (req, res, next) => {
  try {
    sendSuccess(res, {
      userId: req.user!.id,
      email: req.user!.email,
      emailVerified: req.user!.email_verified,
      isAdmin: env.adminEmails.has(req.user!.email.toLowerCase()),
      // Not sensitive (it's just "are real emails going out right now"), so every user gets it,
      // not just admins — the dashboard uses it to hide the "verify your email" nag banner, since
      // nagging someone to check an inbox that will never receive anything is actively confusing.
      emailTestMode: await getEmailTestMode(),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-email/resend", authRateLimiter, requireSession, async (req, res, next) => {
  try {
    await authService.resendVerificationEmail(req.user!.id);
    sendSuccess(res, { sent: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-email/confirm", authRateLimiter, async (req, res, next) => {
  try {
    const { token } = tokenSchema.parse(req.body);
    await authService.verifyEmail(token);
    sendSuccess(res, { verified: true });
  } catch (error) {
    next(error);
  }
});

// Always 200 with the same body regardless of whether the email is registered — see
// requestPasswordReset's silent no-op, this is the other half of not leaking account existence.
authRouter.post("/forgot-password", authRateLimiter, async (req, res, next) => {
  try {
    const { email } = emailSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    sendSuccess(res, { sent: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", authRateLimiter, async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password);
    sendSuccess(res, { reset: true });
  } catch (error) {
    next(error);
  }
});
