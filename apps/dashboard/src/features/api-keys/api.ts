import { apiRequest } from "@/lib/api-client";

export interface ApiKey {
  id: string;
  project_id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedApiKey extends ApiKey {
  /** Present ONLY in the create response — never returned again, never persisted client-side beyond this render. */
  fullKey: string;
}

export function listApiKeys(projectId: string): Promise<ApiKey[]> {
  return apiRequest(`/projects/${projectId}/api-keys`);
}

export function createApiKey(projectId: string, name: string): Promise<CreatedApiKey> {
  return apiRequest(`/projects/${projectId}/api-keys`, { method: "POST", body: { name } });
}

export function revokeApiKey(projectId: string, keyId: string): Promise<{ revoked: boolean }> {
  return apiRequest(`/projects/${projectId}/api-keys/${keyId}`, { method: "DELETE" });
}
