import axios from "axios";

export interface ResolvedProject {
  id: string;
  name: string;
}

/**
 * Four real, distinguishable outcomes from `GET /projects/me` — collapsing them into one silent
 * `undefined` (the previous behavior) is exactly what let a key silently get paired with the
 * wrong server: `openota login` would print "✔ Logged in." identically whether the key was
 * genuinely valid for self-hosted flat auth, or simply wrong for this server entirely.
 *
 * - "project": a real project-scoped key, resolved successfully.
 * - "flat-key": the server's own `UnauthorizedError` message for this exact route is
 *   "This endpoint requires a project-scoped API key..." — that specific message only fires once
 *   `requireApiKey` has already accepted the credential (matches the self-hosted flat
 *   `OPENOTA_API_KEY`, or the server runs fully open with no auth at all); it just isn't a
 *   project-scoped key, which is fine and expected outside Cloud.
 * - "rejected": the server was reached and explicitly said this credential doesn't work (401
 *   with any other message) — a genuinely wrong key for this server. Worth blocking on.
 * - "unreachable": never got a response at all (network error, timeout, DNS failure). Not the
 *   key's fault — don't block saving a key we simply couldn't verify right now.
 */
export type KeyResolution =
  | { kind: "project"; project: ResolvedProject }
  | { kind: "flat-key" }
  | { kind: "rejected"; detail: string }
  | { kind: "unreachable"; detail: string };

const FLAT_KEY_MESSAGE = "This endpoint requires a project-scoped API key";

export async function resolveProjectFromKey(serverUrl: string, apiKey: string): Promise<KeyResolution> {
  try {
    const res = await axios.get<{ success: true; data: ResolvedProject }>(`${serverUrl}/projects/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 5000,
    });
    return { kind: "project", project: res.data.data };
  } catch (error) {
    if (!axios.isAxiosError(error) || !error.response) {
      // No response at all — DNS failure, connection refused, timeout. The server was never
      // actually asked to judge this key, so this says nothing about whether it's valid.
      const detail = error instanceof Error ? error.message : "could not reach server";
      return { kind: "unreachable", detail };
    }
    const message =
      typeof error.response.data === "object"
        ? ((error.response.data as { error?: { message?: string } })?.error?.message ?? "")
        : "";
    if (message.startsWith(FLAT_KEY_MESSAGE)) {
      return { kind: "flat-key" };
    }
    return { kind: "rejected", detail: message || `HTTP ${error.response.status}` };
  }
}
