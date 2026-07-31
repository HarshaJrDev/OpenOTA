import axios from "axios";

export interface ResolvedProject {
  id: string;
  name: string;
}

/**
 * Asks the server which project an API key belongs to (`GET /projects/me`). Returns `undefined`
 * on ANY failure — a self-hosted global `OPENOTA_API_KEY` isn't project-scoped and will 401 here,
 * which is an expected, silent no-op, not an error: `login` still succeeds for self-hosted setups
 * that have no project concept at all.
 */
export async function resolveProjectFromKey(serverUrl: string, apiKey: string): Promise<ResolvedProject | undefined> {
  try {
    const res = await axios.get<{ success: true; data: ResolvedProject }>(`${serverUrl}/projects/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });
    return res.data.data;
  } catch {
    return undefined;
  }
}
