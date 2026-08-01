import type { Platform } from "@openota/shared";
import { useQuery } from "@tanstack/react-query";

import { getInstallResultCounts, getReleaseStats } from "./api";

export function useInstallResultCounts(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["analytics", "install-results", projectId ?? ""],
    queryFn: () => getInstallResultCounts(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useReleaseStats(projectId: string | null | undefined, platform: Platform, version: string) {
  return useQuery({
    queryKey: ["analytics", "release-stats", projectId ?? "", platform, version],
    queryFn: () => getReleaseStats(projectId!, platform, version),
    enabled: Boolean(projectId),
  });
}
