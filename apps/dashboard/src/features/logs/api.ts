import type { Platform } from "@openota/shared";

import { apiRequest } from "@/lib/api-client";

export type LogEventType = "release" | "rollback" | "rollout_change";
export type LogActorType = "api_key" | "user" | "system";

export interface DeploymentLogEntry {
  id: string;
  project_id: string;
  platform: Platform;
  channel: string;
  event_type: LogEventType;
  version: string;
  runtime_version: string | null;
  rollout_percentage: number | null;
  previous_rollout_percentage: number | null;
  reason: string | null;
  actor_type: LogActorType;
  actor_id: string | null;
  /** The API key's own name, resolved server-side — null if the actor wasn't an API key, or that key has since been deleted. */
  actor_name: string | null;
  created_at: string;
}

export interface LogFilters {
  platform?: Platform;
  channel?: string;
  eventType?: LogEventType;
}

export function listLogs(projectId: string, filters: LogFilters = {}): Promise<DeploymentLogEntry[]> {
  return apiRequest<DeploymentLogEntry[]>(`/projects/${projectId}/logs`, {
    query: { platform: filters.platform, channel: filters.channel, eventType: filters.eventType },
  });
}
