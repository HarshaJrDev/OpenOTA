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
