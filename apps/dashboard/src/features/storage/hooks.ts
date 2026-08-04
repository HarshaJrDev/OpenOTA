import { useQuery } from "@tanstack/react-query";

import { getStorageInfo } from "./api";

export function useStorageInfo(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["storage", projectId ?? ""],
    queryFn: () => getStorageInfo(projectId!),
    enabled: Boolean(projectId),
  });
}
