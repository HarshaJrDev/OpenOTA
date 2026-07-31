import { apiRequest } from "@/lib/api-client";

export interface DeviceCheckin {
  id: string;
  project_id: string;
  device_id: string;
  platform: string;
  app_version: string;
  runtime_version: string;
  download_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export function listDevices(projectId: string): Promise<DeviceCheckin[]> {
  return apiRequest<DeviceCheckin[]>(`/projects/${projectId}/devices`);
}
