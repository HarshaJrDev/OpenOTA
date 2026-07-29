import { apiKeysRepo, type ApiKeyRow } from "../../db/repositories.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { generateApiKey } from "./crypto.js";

export function createKey(projectId: string, name: string): { key: ApiKeyRow; fullKey: string } {
  const { fullKey, prefix, hashedKey } = generateApiKey();
  const key = apiKeysRepo.create(projectId, name, prefix, hashedKey);
  return { key, fullKey };
}

export function listKeys(projectId: string): Omit<ApiKeyRow, "hashed_key">[] {
  return apiKeysRepo.listByProject(projectId).map(({ hashed_key: _hashed_key, ...rest }) => rest);
}

export function revokeKey(projectId: string, keyId: string): void {
  const key = apiKeysRepo.findById(keyId);
  if (!key || key.project_id !== projectId) {
    throw new NotFoundError("API key not found");
  }
  if (key.revoked_at) {
    throw new ValidationError("API key is already revoked");
  }
  apiKeysRepo.revoke(keyId);
}
