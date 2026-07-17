const STORAGE_KEY = "openota.dashboard.serverUrl";

/** A client-side override on top of `NEXT_PUBLIC_OPENOTA_SERVER_URL`, so you can point this
 * dashboard at a different server without a rebuild — set from Settings. */
export function getServerUrlOverride(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setServerUrlOverride(url: string | null): void {
  if (typeof window === "undefined") return;
  if (url) {
    window.localStorage.setItem(STORAGE_KEY, url);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
