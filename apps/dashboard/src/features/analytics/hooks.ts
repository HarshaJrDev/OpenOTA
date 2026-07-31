import { useQuery } from "@tanstack/react-query";

import { getInstallResultCounts } from "./api";

export function useInstallResultCounts(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["analytics", "install-results", projectId ?? ""],
    queryFn: () => getInstallResultCounts(projectId!),
    enabled: Boolean(projectId),
  });
}
