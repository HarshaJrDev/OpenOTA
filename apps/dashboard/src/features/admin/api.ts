import { apiRequest } from "@/lib/api-client";

export interface AdminSettings {
  emailTestMode: boolean;
}

export function getAdminSettings(): Promise<AdminSettings> {
  return apiRequest("/admin/settings");
}

export function updateAdminSettings(settings: AdminSettings): Promise<AdminSettings> {
  return apiRequest("/admin/settings", { method: "PATCH", body: settings });
}

export type TrafficApp = "docs" | "dashboard";
export type TrafficRange = "7d" | "30d" | "90d";

export interface TrafficSummary {
  app: TrafficApp;
  range: TrafficRange;
  views: number;
  uniqueVisitors: number;
  daily: Array<{ day: string; views: number }>;
  topPaths: Array<{ path: string; views: number }>;
}

// Note: mounted at /api/v1/traffic, not under /admin — see apps/server/src/app.ts. Real counts
// only, straight from the page_views table nothing here is mocked or seeded.
export function getTraffic(app: TrafficApp, range: TrafficRange): Promise<TrafficSummary> {
  return apiRequest(`/traffic?app=${app}&range=${range}`);
}
