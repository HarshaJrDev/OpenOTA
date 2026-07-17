import { describe, expect, it } from "vitest";

import { compareSemver, isValidSemver } from "../types/version.js";

describe("isValidSemver", () => {
  it("accepts a well-formed version", () => {
    expect(isValidSemver("1.2.3")).toBe(true);
  });

  it("rejects a malformed version", () => {
    expect(isValidSemver("1.2")).toBe(false);
    expect(isValidSemver("v1.2.3")).toBe(false);
  });
});

describe("compareSemver", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareSemver("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
  });
});
