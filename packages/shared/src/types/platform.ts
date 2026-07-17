export const SUPPORTED_PLATFORMS = ["android", "ios"] as const;

export type Platform = (typeof SUPPORTED_PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (SUPPORTED_PLATFORMS as readonly string[]).includes(value);
}
