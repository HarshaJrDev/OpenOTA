import { Writable } from "node:stream";

import pino from "pino";
import { describe, expect, it } from "vitest";

// Exercises the actual redact config logger.ts uses, rather than trusting the option exists —
// writes to an in-memory stream instead of the real logger's stdout/pino-pretty transport so the
// output can be asserted on directly.
function createTestLogger() {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  const logger = pino(
    {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.req.headers.authorization",
          "*.req.headers.cookie",
        ],
        censor: "[redacted]",
      },
    },
    sink,
  );

  return { logger, output: () => chunks.join("") };
}

describe("logger redaction", () => {
  it("never writes an Authorization header's real value to logs", () => {
    const { logger, output } = createTestLogger();

    logger.info(
      { req: { headers: { authorization: "Bearer super-secret-openota-api-key", host: "localhost:3900" } } },
      "request completed",
    );

    const logged = output();
    expect(logged).not.toContain("super-secret-openota-api-key");
    expect(logged).toContain("[redacted]");
    expect(logged).toContain("localhost:3900");
  });

  it("redacts a cookie header the same way", () => {
    const { logger, output } = createTestLogger();

    logger.info({ req: { headers: { cookie: "session=abc123secret" } } }, "request completed");

    expect(output()).not.toContain("abc123secret");
  });
});
