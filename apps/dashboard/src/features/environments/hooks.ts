import type { Platform } from "@openota/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import { getEnvironmentHistory, listEnvironments, updateEnvironment } from "./api";

export const environmentKeys = {
  list: (projectId: string) => ["environments", projectId] as const,
  history: (projectId: string, channel: string, platform: Platform) =>
    ["environments", projectId, channel, "history", platform] as const,
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
