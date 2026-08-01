import * as Sentry from "@sentry/node";

import { env } from "./env.js";

/**
 * Unset SENTRY_DSN → every function here is a no-op. Same "optional, degrades to nothing" posture
 * as RESEND_API_KEY (see auth/email.service.ts) — error tracking is a nice-to-have, not something
 * that should ever block booting or require infra just to run OpenOTA self-hosted.
 */
export function initSentry(): void {
  if (!env.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    // Errors only, no perf tracing — this is about knowing when something breaks in production,
    // not APM. Can be raised later if latency tracing becomes worth the added noise/cost.
    tracesSampleRate: 0,
  });
}

export function captureException(error: unknown): void {
  if (!env.sentryDsn) {
    return;
  }
  Sentry.captureException(error);
}
