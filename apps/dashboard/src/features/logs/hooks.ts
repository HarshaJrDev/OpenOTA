import { useQuery } from "@tanstack/react-query";

import { listLogs, type LogFilters } from "./api";

export const logKeys = {
  list: (projectId: string, filters: LogFilters) => ["logs", projectId, filters] as const,
};

export function useLogs(projectId: string | null | undefined, filters: LogFilters = {}) {
  return useQuery({
    queryKey: logKeys.list(projectId ?? "", filters),
    queryFn: () => listLogs(projectId!, filters),
    enabled: Boolean(projectId),
  });
}
