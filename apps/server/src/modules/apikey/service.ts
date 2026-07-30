import { apiKeysRepo, type ApiKeyRow } from "../../db/repositories.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import { generateApiKey } from "./crypto.js";

export async function createKey(projectId: string, name: string): Promise<{ key: ApiKeyRow; fullKey: string }> {
  const { fullKey, prefix, hashedKey } = generateApiKey();
  const key = await apiKeysRepo.create(projectId, name, prefix, hashedKey);
  return { key, fullKey };
}

export async function listKeys(projectId: string): Promise<Omit<ApiKeyRow, "hashed_key">[]> {
  const keys = await apiKeysRepo.listByProject(projectId);
  return keys.map(({ hashed_key: _hashed_key, ...rest }) => rest);
}

export async function revokeKey(projectId: string, keyId: string): Promise<void> {
  const key = await apiKeysRepo.findById(keyId);
  if (!key || key.project_id !== projectId) {
    throw new NotFoundError("API key not found");
  }
  if (key.revoked_at) {
    throw new ValidationError("API key is already revoked");
  }
  await apiKeysRepo.revoke(keyId);
}
