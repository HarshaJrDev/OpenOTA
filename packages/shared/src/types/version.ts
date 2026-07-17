const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export type SemverString = string;

export function isValidSemver(version: string): boolean {
  return SEMVER_PATTERN.test(version);
}

/** Returns <0 if `a` precedes `b`, 0 if equal, >0 if `a` follows `b`. Non-numeric segments compare as 0. */
export function compareSemver(a: SemverString, b: SemverString): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < 3; i += 1) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;

    if (numA !== numB) {
      return numA - numB;
    }
  }

  return 0;
}
