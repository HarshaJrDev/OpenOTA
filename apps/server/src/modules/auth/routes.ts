import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { requireSession } from "../../middleware/session.middleware.js";
import { sendSuccess } from "../../shared/responses.js";
import { setSessionCookie, clearSessionCookie } from "./cookie.js";
import * as authService from "./service.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRouter: ExpressRouter = Router();

authRouter.post("/signup", (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = authService.signup(email, password);
    setSessionCookie(res, token);
    sendSuccess(res, { userId }, 201);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const { userId, token } = authService.login(email, password);
    setSessionCookie(res, token);
    sendSuccess(res, { userId });
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
