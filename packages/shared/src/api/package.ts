import type { Manifest } from "./manifest.js";

/** Everything about a stored package except its download URL — what the server persists as `metadata.json`. */
export type PackageMetadata = Omit<Manifest, "downloadUrl">;

/** Response shape for `GET /api/v1/packages/check` — identical across server response and SDK consumption. */
export interface CheckResponse {
  available: boolean;
  latestVersion: string | null;
  downloadUrl: string | null;
  manifest: Manifest | null;
}
