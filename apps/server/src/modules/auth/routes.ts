import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { authRateLimiter } from "../../middleware/rateLimit.middleware.js";
import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import { setSessionCookie, clearSessionCookie } from "./cookie.js";
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

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  sendSuccess(res, { loggedOut: true });
});

authRouter.get("/me", requireSession, (req, res) => {
  sendSuccess(res, { userId: req.user!.id, email: req.user!.email, emailVerified: req.user!.email_verified });
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
