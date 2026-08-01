import path from "node:path";

import { assertSafePathSegment as assertSafePathSegmentShared } from "@openota/shared";

import { ValidationError } from "./errors.js";

export { compareSemver, isValidSemver } from "@openota/shared";

/** Server-local wrapper: same segment safety check, rethrown as the server's own `ValidationError`. */
export function assertSafePathSegment(segment: string): string {
  try {
    return assertSafePathSegmentShared(segment);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Invalid path segment");
  }
}

/**
 * Deterministic 0-99 bucket for a device on a given release, used to gate staged rollout in
 * package/service.ts. Keying on the release id (not just the version string) means each new
 * release re-buckets every device independently — a device excluded from one rollout isn't
 * permanently excluded from the next. FNV-1a: fast, well-distributed, no dependency needed.
 */
export function rolloutBucket(deviceId: string, releaseKey: string): number {
  const input = `${deviceId}:${releaseKey}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 100;
}

export function assertWithinRoot(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new ValidationError("Path traversal detected");
  }

  return resolvedTarget;
}
