import type { Platform } from "@openota/shared";

import { apiRequest } from "@/lib/api-client";

export interface InstallResultCounts {
  success: number;
  failure: number;
  rollback: number;
}

export interface ReleaseChannelActivation {
  channel: string;
  status: "active" | "inactive" | "rolled_back";
  rollout_percentage: number;
  release_notes: string | null;
  rollback_reason: string | null;
  created_at: string;
}

export interface ReleaseStats {
  installCounts: InstallResultCounts;
  devicesOnVersion: number;
  channels: ReleaseChannelActivation[];
}

export function getInstallResultCounts(projectId: string): Promise<InstallResultCounts> {
  return apiRequest<InstallResultCounts>(`/projects/${projectId}/analytics/install-results`);
}

export function getReleaseStats(projectId: string, platform: Platform, version: string): Promise<ReleaseStats> {
  return apiRequest<ReleaseStats>(`/projects/${projectId}/analytics/releases/${platform}/${version}`);
}
