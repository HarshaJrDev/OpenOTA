import { afterEach, describe, expect, it } from "vitest";

import { configure, getConfig, resetConfig } from "../config.js";
import { OTAError } from "../errors.js";

afterEach(() => {
  resetConfig();
});

describe("config", () => {
  it("throws when not configured", () => {
    expect(() => getConfig()).toThrow(OTAError);
  });

  it("applies defaults for optional fields", () => {
    const config = configure({ serverUrl: "https://api.example.com/api/v1" });

    expect(config.channel).toBe("production");
    expect(config.autoRestart).toBe(true);
    expect(config.requestTimeout).toBe(15_000);
  });

  it("strips trailing slashes from serverUrl", () => {
    const config = configure({ serverUrl: "https://api.example.com/api/v1///" });
    expect(config.serverUrl).toBe("https://api.example.com/api/v1");
  });

  it("rejects a non-absolute serverUrl", () => {
    expect(() => configure({ serverUrl: "not-a-url" })).toThrow(OTAError);
  });

  it("honors explicit overrides", () => {
    const config = configure({
      serverUrl: "https://api.example.com/api/v1",
      channel: "beta",
      autoRestart: false,
      requestTimeout: 5000,
    });

    expect(config.channel).toBe("beta");
    expect(config.autoRestart).toBe(false);
    expect(config.requestTimeout).toBe(5000);
  });
});
