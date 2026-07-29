import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import * as apiKeysApi from "./api";

export const apiKeyKeys = {
  list: (projectId: string) => ["api-keys", projectId] as const,
};

export function useApiKeys(projectId: string | undefined) {
  return useQuery({
    queryKey: apiKeyKeys.list(projectId ?? ""),
    queryFn: () => apiKeysApi.listApiKeys(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiKeysApi.createApiKey(projectId, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(projectId) }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to create key"),
  });
}

export function useRevokeApiKey(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => apiKeysApi.revokeApiKey(projectId, keyId),
    onSuccess: () => {
      toast.success("API key revoked");
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.list(projectId) });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Failed to revoke key"),
  });
}
