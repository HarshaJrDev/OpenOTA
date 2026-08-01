import type { Platform } from "@openota/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import { listAppConfigs, upsertAppConfig, type UpsertAppConfigFields } from "./api";

export const appConfigKeys = {
  list: (projectId: string) => ["apps", projectId] as const,
};

export function useAppConfigs(projectId: string | null | undefined) {
  return useQuery({
    queryKey: appConfigKeys.list(projectId ?? ""),
    queryFn: () => listAppConfigs(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUpsertAppConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platform, fields }: { platform: Platform; fields: UpsertAppConfigFields }) =>
      upsertAppConfig(projectId, platform, fields),
    onSuccess: () => {
      toast.success("App settings saved");
      void queryClient.invalidateQueries({ queryKey: appConfigKeys.list(projectId) });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to save app settings"),
  });
}
