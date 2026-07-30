import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initDb } from "./db/client.js";

// Bootstrap the database (connect + create tables) before accepting any request.
initDb()
  .then(() => {
    app.listen(env.port, () => {
      logger.info(`🚀 OpenOTA running on http://localhost:${env.port}`);
    });
  })
  .catch((error) => {
    logger.error({ err: error }, "Failed to initialize the database — shutting down");
    process.exit(1);
  });
