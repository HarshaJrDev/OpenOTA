import type { ProjectRow, UserRow } from "../db/repositories.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireApiKey when the presented token is a project-scoped `ota_live_` key. */
      project?: ProjectRow;
      /** Set alongside `project` only on the api_keys.id path (never for session-cookie auth) — used to attribute release history to the key that made it. */
      apiKeyId?: string;
      /** Set by requireSession for dashboard (cookie-authenticated) routes. */
      user?: UserRow;
    }
  }
}

export {};
