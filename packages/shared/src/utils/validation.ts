const SAFE_SEGMENT_PATTERN = /^[a-zA-Z0-9._-]+$/;

export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathSecurityError";
  }
}

/**
 * Pure, filesystem-free check that a single path segment (a platform name, a version string used
 * as a directory name, ...) cannot be used to escape a parent directory. This is intentionally the
 * only path-safety logic that lives here: resolving and checking an actual filesystem path needs
 * `node:path` (server, CLI) or RN's string-based path handling (SDK), which are not portable to a
 * single shared implementation — each package keeps its own `assertWithinRoot`-style check built
 * on top of this segment guard.
 */
export function assertSafePathSegment(segment: string): string {
  if (
    segment.length === 0 ||
    !SAFE_SEGMENT_PATTERN.test(segment) ||
    segment === "." ||
    segment === ".." ||
    segment.includes("/") ||
    segment.includes("\\")
  ) {
    throw new PathSecurityError(`Invalid path segment: "${segment}"`);
  }

  return segment;
}
