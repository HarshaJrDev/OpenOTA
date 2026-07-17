import type { Request, Response } from "express";

import { sendError } from "../shared/responses.js";

export function notFoundMiddleware(req: Request, res: Response) {
  sendError(res, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`, 404);
}
