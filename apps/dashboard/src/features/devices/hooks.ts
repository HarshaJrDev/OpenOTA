import { useQuery } from "@tanstack/react-query";

import { listDevices } from "./api";

export const deviceKeys = {
  list: (projectId: string) => ["devices", projectId] as const,
};

export function useDevices(projectId: string | null | undefined) {
  return useQuery({
    queryKey: deviceKeys.list(projectId ?? ""),
    queryFn: () => listDevices(projectId!),
    enabled: Boolean(projectId),
  });
}
