import { apiRequest } from "@/lib/api-client";

export interface StorageInfo {
  provider: "local" | "supabase";
  bucket: string | null;
  storageRoot: string | null;
  healthy: boolean;
  packageCount: number;
  bytesUsed: number;
}

export function getStorageInfo(projectId: string): Promise<StorageInfo> {
  return apiRequest<StorageInfo>(`/projects/${projectId}/storage`);
}
