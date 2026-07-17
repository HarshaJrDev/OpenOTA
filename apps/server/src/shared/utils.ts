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

export function assertWithinRoot(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new ValidationError("Path traversal detected");
  }

  return resolvedTarget;
}
