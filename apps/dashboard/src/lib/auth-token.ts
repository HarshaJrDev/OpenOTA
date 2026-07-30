const STORAGE_KEY = "openota.dashboard.token";

/**
 * The dashboard's session token, kept in localStorage and sent as `Authorization: Bearer <token>`
 * on every API call (see api-client). This is the primary auth mechanism in production because the
 * dashboard and API live on different registrable domains, making the session *cookie* a
 * third-party cookie that browsers may block. The cookie is still set by the server and works for
 * same-origin/self-hosted setups; this token path is what makes cross-domain deployments reliable.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
