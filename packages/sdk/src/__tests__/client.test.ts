import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "../client.js";
import { configure, resetConfig } from "../config.js";
import { NetworkError } from "../errors.js";

beforeEach(() => {
  configure({ serverUrl: "https://api.example.com/api/v1" });
});

afterEach(() => {
  resetConfig();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiGet", () => {
  it("returns data on a successful envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: { foo: "bar" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiGet<{ foo: string }>("/packages/check", { platform: "android" });

    expect(data).toEqual({ foo: "bar" });
    const calledUrl = (fetchMock.mock.calls[0]?.[0] ?? "") as string;
    expect(calledUrl).toBe("https://api.example.com/api/v1/packages/check?platform=android");
  });

  it("throws NetworkError on a failure envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({ success: false, error: { code: "NOT_FOUND", message: "missing" } }),
      }),
    );

    await expect(apiGet("/packages/check")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws NetworkError when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    await expect(apiGet("/packages/check")).rejects.toBeInstanceOf(NetworkError);
  });
});
