import { apiRequest } from "@/lib/api-client";

export interface InstallResultCounts {
  success: number;
  failure: number;
  rollback: number;
}

export function getInstallResultCounts(projectId: string): Promise<InstallResultCounts> {
  return apiRequest<InstallResultCounts>(`/projects/${projectId}/analytics/install-results`);
}
