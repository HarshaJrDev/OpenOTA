import type { Platform } from "@openota/shared";

import { apiRequest } from "@/lib/api-client";

export interface EnvironmentRelease {
  id: string;
  version: string;
  runtime_version: string;
  status: "active" | "inactive" | "rolled_back";
  release_notes: string | null;
  rollback_reason: string | null;
  rollout_percentage: number;
  created_at: string;
}

export interface DeploymentEvent {
  id: string;
  event_type: "release" | "rollback" | "rollout_change";
  version: string;
  runtime_version: string | null;
  rollout_percentage: number | null;
  previous_rollout_percentage: number | null;
  release_notes: string | null;
  reason: string | null;
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

export function getEnvironmentHistory(projectId: string, channel: string, platform: Platform): Promise<DeploymentEvent[]> {
  return apiRequest<DeploymentEvent[]>(`/projects/${projectId}/environments/${channel}/history`, {
    query: { platform },
  });
}

export function updateRolloutPercentage(
  projectId: string,
  channel: string,
  platform: Platform,
  percentage: number,
): Promise<EnvironmentRelease> {
  return apiRequest<EnvironmentRelease>(`/projects/${projectId}/environments/${channel}/rollout`, {
    method: "PATCH",
    body: { platform, percentage },
  });
}

export interface LiveCount {
  count: number;
  android?: number;
  ios?: number;
}

export function getLiveCount(projectId: string, channel: string): Promise<LiveCount> {
  return apiRequest<LiveCount>(`/projects/${projectId}/environments/${channel}/live-count`);
}
