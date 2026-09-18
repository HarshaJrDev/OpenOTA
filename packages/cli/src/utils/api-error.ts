import axios from "axios";

const FLAT_KEY_MESSAGE = "This endpoint requires a project-scoped API key";

/**
 * Turns a raw axios failure from a release/upload/rollback request into the same actionable
 * category `openota login`'s resolveProjectFromKey already distinguishes (see project.service.ts)
 * — a bare "Request failed with status code 401" told the user nothing about whether they needed
 * to re-login, whether the key was wrong for this project, or whether the server was just down.
 * Never includes the request's Authorization header or the API key itself — only the server's own
 * response message, which the server already guarantees never echoes the credential back.
 */
export function describeApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unknown error";
  }

  if (!error.response) {
    return `Could not reach the server (${error.message}). Check the server is running and reachable.`;
  }

  const { status } = error.response;
  const serverMessage =
    typeof error.response.data === "object"
      ? ((error.response.data as { error?: { message?: string } })?.error?.message ?? "")
      : "";

  if (status === 401) {
    if (serverMessage.startsWith(FLAT_KEY_MESSAGE)) {
      return "This server requires a project-scoped API key, but no project is configured (or the stored key is a self-hosted flat key). Run `openota login --api-key <key>` with a project-scoped key, or check openota.config.json's projectId.";
    }
    return `Authentication failed: the API key was rejected (${serverMessage || "missing or invalid API key"}). It may be invalid, expired, or revoked. Run \`openota login --api-key <key>\` to re-authenticate.`;
  }

  if (status === 403) {
    return `Not authorized: ${serverMessage || "this API key does not have access to the requested project/environment"}.`;
  }

  return `Request failed with status ${status}${serverMessage ? `: ${serverMessage}` : ""}`;
}
