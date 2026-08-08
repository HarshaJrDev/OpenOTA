"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { getEffectiveServerUrl } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth-token";

// Real, first-party pageview tracking for the dashboard itself — same beacon shape as the docs
// site's (apps/docs/app/components/traffic-beacon.tsx), feeding apps/server's modules/traffic.
// `credentials: "include"` lets the server attribute the view to the real logged-in user via
// their session cookie when one exists (login/signup pages have none — those still count as
// anonymous views, which is correct).
const VISITOR_ID_KEY = "openota_visitor_id";

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function TrafficBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    const token = getAuthToken();
    fetch(`${getEffectiveServerUrl()}/analytics/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        app: "dashboard",
        path: pathname,
        referrer: document.referrer || null,
        visitorId: getVisitorId(),
      }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {});
    return () => controller.abort();
  }, [pathname]);

  return null;
}
