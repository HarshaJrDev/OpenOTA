import type { Platform } from "@openota/shared";

import { apiRequest } from "@/lib/api-client";

export interface AppConfig {
  id: string;
  project_id: string;
  platform: Platform;
  runtime_version: string;
  package_name: string | null;
  bundle_identifier: string | null;
  min_supported_version: string | null;
  remote_config: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpsertAppConfigFields {
  runtimeVersion?: string;
  // `null` explicitly clears the field server-side; `undefined` leaves whatever's already stored
  // alone. Always send one or the other deliberately — see apps/routes.ts's schema doc comment.
  packageName?: string | null;
  bundleIdentifier?: string | null;
  minSupportedVersion?: string | null;
  remoteConfig?: Record<string, unknown> | null;
}

export function listAppConfigs(projectId: string): Promise<AppConfig[]> {
  return apiRequest<AppConfig[]>(`/projects/${projectId}/apps`);
}

export function upsertAppConfig(projectId: string, platform: Platform, fields: UpsertAppConfigFields): Promise<AppConfig> {
  return apiRequest<AppConfig>(`/projects/${projectId}/apps/${platform}`, { method: "PUT", body: fields });
}
