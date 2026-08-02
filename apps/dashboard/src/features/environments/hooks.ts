import type { Platform } from "@openota/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import { getEnvironmentHistory, getLiveCount, listEnvironments, updateEnvironment, updateRolloutPercentage } from "./api";

export const environmentKeys = {
  list: (projectId: string) => ["environments", projectId] as const,
  history: (projectId: string, channel: string, platform: Platform) =>
    ["environments", projectId, channel, "history", platform] as const,
  liveCount: (projectId: string, channel: string) => ["environments", projectId, channel, "live-count"] as const,
};

export function useEnvironments(projectId: string | null | undefined) {
  return useQuery({
    queryKey: environmentKeys.list(projectId ?? ""),
    queryFn: () => listEnvironments(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useEnvironmentHistory(projectId: string | undefined, channel: string, platform: Platform, enabled = true) {
  return useQuery({
    queryKey: environmentKeys.history(projectId ?? "", channel, platform),
    queryFn: () => getEnvironmentHistory(projectId!, channel, platform),
    enabled: enabled && Boolean(projectId),
  });
}

export function useLiveCount(projectId: string | undefined, channel: string) {
  return useQuery({
    queryKey: environmentKeys.liveCount(projectId ?? "", channel),
    queryFn: () => getLiveCount(projectId!, channel),
    enabled: Boolean(projectId),
    // Cheap in-memory Set lookup server-side — fine to poll frequently for a "live" feel.
    refetchInterval: 15_000,
  });
}

export function useUpdateEnvironment(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, fields }: { channel: string; fields: { name?: string; color?: string; description?: string } }) =>
      updateEnvironment(projectId, channel, fields),
    onSuccess: () => {
      toast.success("Environment updated");
      void queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update environment"),
  });
}

export function useUpdateRolloutPercentage(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, platform, percentage }: { channel: string; platform: Platform; percentage: number }) =>
      updateRolloutPercentage(projectId, channel, platform, percentage),
    onSuccess: (_data, { channel, platform }) => {
      toast.success("Rollout updated");
      void queryClient.invalidateQueries({ queryKey: environmentKeys.list(projectId) });
      void queryClient.invalidateQueries({ queryKey: environmentKeys.history(projectId, channel, platform) });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to update rollout"),
  });
}
