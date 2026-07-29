import type { Platform } from "@openota/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import { checkForUpdate, deletePackage, getPackage, listPackages, rollbackPackage } from "./api";

export const packageKeys = {
  all: (projectId: string) => ["packages", projectId] as const,
  list: (projectId: string) => [...packageKeys.all(projectId), "list"] as const,
  detail: (projectId: string, platform: Platform, version: string) =>
    [...packageKeys.all(projectId), "detail", platform, version] as const,
  check: (projectId: string, platform: Platform, currentVersion: string) =>
    [...packageKeys.all(projectId), "check", platform, currentVersion] as const,
};

export function usePackages(projectId: string | null | undefined) {
  return useQuery({
    queryKey: packageKeys.list(projectId ?? ""),
    queryFn: () => listPackages(projectId!),
    enabled: Boolean(projectId),
  });
}

export function usePackageDetail(projectId: string | undefined, platform: Platform, version: string) {
  return useQuery({
    queryKey: packageKeys.detail(projectId ?? "", platform, version),
    queryFn: () => getPackage(projectId!, platform, version),
    enabled: Boolean(projectId),
  });
}

export function useCheckForUpdate(projectId: string | undefined, platform: Platform, currentVersion: string, enabled = true) {
  return useQuery({
    queryKey: packageKeys.check(projectId ?? "", platform, currentVersion),
    queryFn: () => checkForUpdate(projectId!, platform, currentVersion),
    enabled: enabled && Boolean(projectId),
  });
}

export function useDeletePackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, version }: { platform: Platform; version: string }) => deletePackage(projectId, platform, version),
    onSuccess: (_data, { platform, version }) => {
      toast.success(`Deleted ${platform}@${version}`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.list(projectId) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete package");
    },
  });
}

export function useRollbackPackage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, version }: { platform: Platform; version: string }) => rollbackPackage(projectId, platform, version),
    onSuccess: (manifest) => {
      toast.success(`Rolled back ${manifest.platform} to v${manifest.bundleVersion}`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.all(projectId) });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Rollback failed");
    },
  });
}
