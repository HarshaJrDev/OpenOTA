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
  push_title: string | null;
  push_body: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UpsertAppConfigFields {
  runtimeVersion?: string;
  packageName?: string;
  bundleIdentifier?: string;
  minSupportedVersion?: string;
  remoteConfig?: Record<string, unknown>;
  pushTitle?: string;
  pushBody?: string;
}

export function listAppConfigs(projectId: string): Promise<AppConfig[]> {
  return apiRequest<AppConfig[]>(`/projects/${projectId}/apps`);
}

export function upsertAppConfig(projectId: string, platform: Platform, fields: UpsertAppConfigFields): Promise<AppConfig> {
  return apiRequest<AppConfig>(`/projects/${projectId}/apps/${platform}`, { method: "PUT", body: fields });
}
