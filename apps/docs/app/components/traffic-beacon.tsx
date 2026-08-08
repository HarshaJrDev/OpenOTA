"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Real, first-party pageview tracking — feeds the admin Traffic panel (apps/server's
// modules/traffic). Not GA4/Clarity (those stay separate, env-gated, in analytics.tsx): this is
// OpenOTA's own operator-facing "how many people actually visit the site" number, with no
// external dependency and nothing fabricated — every row here is a real request that happened.
const API_URL = process.env.NEXT_PUBLIC_OPENOTA_API_URL ?? "https://api.openota.xyz/api/v1";
const VISITOR_ID_KEY = "openota_visitor_id";

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, fresh);
    return fresh;
  } catch {
    // Private browsing / storage disabled — fall back to a per-load id rather than crashing or
    // skipping the beacon; this visit still counts, just not tied to the same visitor next time.
    return crypto.randomUUID();
  }
}

export function TrafficBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "docs",
        path: pathname,
        referrer: document.referrer || null,
        visitorId: getVisitorId(),
      }),
      signal: controller.signal,
      // Best-effort — a blocked/failed beacon must never affect the page itself.
      keepalive: true,
    }).catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  return null;
}
