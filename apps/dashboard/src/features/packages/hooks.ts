import type { Platform } from "@openota/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import { checkForUpdate, deletePackage, getPackage, listPackages, rollbackPackage } from "./api";

export const packageKeys = {
  all: ["packages"] as const,
  list: () => [...packageKeys.all, "list"] as const,
  detail: (platform: Platform, version: string) => [...packageKeys.all, "detail", platform, version] as const,
  check: (platform: Platform, currentVersion: string) => [...packageKeys.all, "check", platform, currentVersion] as const,
};

export function usePackages() {
  return useQuery({
    queryKey: packageKeys.list(),
    queryFn: listPackages,
  });
}

export function usePackageDetail(platform: Platform, version: string) {
  return useQuery({
    queryKey: packageKeys.detail(platform, version),
    queryFn: () => getPackage(platform, version),
  });
}

export function useCheckForUpdate(platform: Platform, currentVersion: string, enabled = true) {
  return useQuery({
    queryKey: packageKeys.check(platform, currentVersion),
    queryFn: () => checkForUpdate(platform, currentVersion),
    enabled,
  });
}

export function useDeletePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, version }: { platform: Platform; version: string }) => deletePackage(platform, version),
    onSuccess: (_data, { platform, version }) => {
      toast.success(`Deleted ${platform}@${version}`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete package");
    },
  });
}

export function useRollbackPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, version }: { platform: Platform; version: string }) => rollbackPackage(platform, version),
    onSuccess: (manifest) => {
      toast.success(`Rolled back ${manifest.platform} to v${manifest.bundleVersion}`);
      void queryClient.invalidateQueries({ queryKey: packageKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Rollback failed");
    },
  });
}
