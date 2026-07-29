import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { z } from "zod";

const CREDENTIALS_DIR = path.join(os.homedir(), ".openota");
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, "credentials.json");

const credentialsSchema = z.object({
  servers: z.record(z.string(), z.object({ apiKey: z.string(), createdAt: z.string() })),
});

type CredentialsFile = z.infer<typeof credentialsSchema>;

/**
 * User-level, keyed by server URL so one machine can hold credentials for multiple OpenOTA
 * servers (self-hosted + cloud) at once. Deliberately NOT `openota.config.json`: that file lives
 * in the project repo and is meant to be committed — a secret API key has no business there (see
 * login.ts's history/CHANGELOG for the bug this fixes). `0o700`/`0o600` so the key isn't readable
 * by other local users on a shared machine.
 */
async function readCredentials(): Promise<CredentialsFile> {
  if (!(await fse.pathExists(CREDENTIALS_PATH))) {
    return { servers: {} };
  }

  const raw: unknown = await fse.readJson(CREDENTIALS_PATH);
  const result = credentialsSchema.safeParse(raw);
  return result.success ? result.data : { servers: {} };
}

async function writeCredentials(data: CredentialsFile): Promise<void> {
  await fse.ensureDir(CREDENTIALS_DIR, { mode: 0o700 });
  await fse.writeJson(CREDENTIALS_PATH, data, { spaces: 2, mode: 0o600 });
  // fse.ensureDir/writeJson don't reliably enforce mode on an already-existing dir/file (mode is
  // only applied on creation on some platforms), so set it explicitly every write.
  await fse.chmod(CREDENTIALS_DIR, 0o700).catch(() => undefined);
  await fse.chmod(CREDENTIALS_PATH, 0o600).catch(() => undefined);
}

export async function saveApiKey(serverUrl: string, apiKey: string): Promise<void> {
  const credentials = await readCredentials();
  credentials.servers[serverUrl] = { apiKey, createdAt: new Date().toISOString() };
  await writeCredentials(credentials);
}

export async function getApiKey(serverUrl: string): Promise<string | undefined> {
  const credentials = await readCredentials();
  return credentials.servers[serverUrl]?.apiKey;
}

export async function removeApiKey(serverUrl: string): Promise<void> {
  const credentials = await readCredentials();
  delete credentials.servers[serverUrl];
  await writeCredentials(credentials);
}

export async function credentialsFileMode(): Promise<number | undefined> {
  if (!(await fse.pathExists(CREDENTIALS_PATH))) {
    return undefined;
  }
  const stat = await fse.stat(CREDENTIALS_PATH);
  return stat.mode & 0o777;
}

export { CREDENTIALS_PATH };
