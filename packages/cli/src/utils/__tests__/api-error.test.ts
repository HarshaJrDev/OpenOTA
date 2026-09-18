import { describe, expect, it } from "vitest";

import { describeApiError } from "../api-error.js";

function axiosError(status: number, message?: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: message ? { error: { message } } : {} },
  };
}

describe("describeApiError", () => {
  it("turns a bare 401 into an actionable re-authentication message", () => {
    const message = describeApiError(axiosError(401, "Missing or invalid API key"));
    expect(message).toContain("Authentication failed");
    expect(message).toContain("openota login");
    expect(message).not.toBe("Request failed with status code 401");
  });

  it("recognizes the flat-key-required 401 distinctly from a rejected key", () => {
    const message = describeApiError(axiosError(401, "This endpoint requires a project-scoped API key (Authorization: Bearer ota_live_...)."));
    expect(message).toContain("project-scoped API key");
    expect(message).not.toContain("Authentication failed");
  });

  it("describes a 403 as a project/environment authorization failure, not a generic error", () => {
    const message = describeApiError(axiosError(403, "This key does not have access to this environment"));
    expect(message).toContain("Not authorized");
  });

  it("describes a network failure (no response at all) without implying the key is wrong", () => {
    const message = describeApiError({ isAxiosError: true, message: "connect ECONNREFUSED" });
    expect(message).toContain("Could not reach the server");
    expect(message).not.toContain("Authentication failed");
  });

  it("falls back to a plain error message for a non-axios error", () => {
    expect(describeApiError(new Error("disk full"))).toBe("disk full");
  });

  it("never echoes an Authorization header or API key value even if present on the error object", () => {
    const withHeaders = {
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: { status: 401, data: { error: { message: "Missing or invalid API key" } } },
      config: { headers: { Authorization: "Bearer super-secret-real-key" } },
    };
    const message = describeApiError(withHeaders);
    expect(message).not.toContain("super-secret-real-key");
  });
});
