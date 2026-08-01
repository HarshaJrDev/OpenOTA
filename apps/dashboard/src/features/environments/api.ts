import type { Platform } from "@openota/shared";

import { apiRequest } from "@/lib/api-client";

export interface EnvironmentRelease {
  id: string;
  version: string;
  runtime_version: string;
  status: "active" | "inactive" | "rolled_back";
  release_notes: string | null;
  rollback_reason: string | null;
  created_at: string;
}

export interface Environment {
  id: string;
  channel: string;
  name: string;
  color: string;
  description: string | null;
  active: {
    android: EnvironmentRelease | null;
    ios: EnvironmentRelease | null;
  };
}

export function listEnvironments(projectId: string): Promise<Environment[]> {
  return apiRequest<Environment[]>(`/projects/${projectId}/environments`);
}

export function updateEnvironment(
  projectId: string,
  channel: string,
  fields: { name?: string; color?: string; description?: string },
): Promise<Environment> {
  return apiRequest<Environment>(`/projects/${projectId}/environments/${channel}`, { method: "PATCH", body: fields });
}

export function getEnvironmentHistory(projectId: string, channel: string, platform: Platform): Promise<EnvironmentRelease[]> {
  return apiRequest<EnvironmentRelease[]>(`/projects/${projectId}/environments/${channel}/history`, {
    query: { platform },
  });
}
