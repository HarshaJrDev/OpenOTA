import type { ProjectRow, UserRow } from "../db/repositories.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireApiKey when the presented token is a project-scoped `ota_live_` key. */
      project?: ProjectRow;
      /** Set by requireSession for dashboard (cookie-authenticated) routes. */
      user?: UserRow;
    }
  }
}

export {};
