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

export const authRouter: ExpressRouter = Router();

authRouter.post("/signup", authRateLimiter, (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = authService.signup(email, password);
    setSessionCookie(res, token); // same-origin / self-hosted
    // token is ALSO returned so a cross-domain dashboard can send it as a Bearer header, which
    // works even when the browser blocks the third-party session cookie. See session.middleware.
    sendSuccess(res, { userId, token }, 201);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", authRateLimiter, (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = authService.login(email, password);
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
  sendSuccess(res, { userId: req.user!.id, email: req.user!.email });
});
