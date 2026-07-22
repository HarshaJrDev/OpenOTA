import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDefaultConfig,
  ConfigNotFoundError,
  ConfigValidationError,
  InvalidRuntimeVersionFormatError,
  loadConfig,
  MissingRuntimeVersionError,
  writeConfig,
} from "../config.service.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cli-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("config.service", () => {
  it("throws ConfigNotFoundError when no config exists", async () => {
    await expect(loadConfig(root)).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it("writes and loads a valid config", async () => {
    const config = buildDefaultConfig("http://localhost:3001/api/v1", "1.0.0");
    await writeConfig(root, config);

    const loaded = await loadConfig(root);
    expect(loaded).toEqual(config);
    expect(loaded.runtimeVersion).toBe("1.0.0");
  });

  it("rejects an invalid config", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), { serverUrl: "not-a-url" });
    await expect(loadConfig(root)).rejects.toBeInstanceOf(ConfigValidationError);
  });

  it("C: throws a dedicated, actionable error when runtimeVersion is the only thing missing", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), {
      serverUrl: "http://localhost:3001/api/v1",
      platforms: ["android"],
    });

    await expect(loadConfig(root)).rejects.toBeInstanceOf(MissingRuntimeVersionError);
    await expect(loadConfig(root)).rejects.toThrow('"runtimeVersion" is required');
  });

  it("rejects an empty-string runtimeVersion", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), {
      serverUrl: "http://localhost:3001/api/v1",
      platforms: ["android"],
      runtimeVersion: "",
    });

    await expect(loadConfig(root)).rejects.toBeInstanceOf(MissingRuntimeVersionError);
  });

  it("rejects a runtimeVersion that isn't valid semver, mirroring the server's own rule", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), {
      serverUrl: "http://localhost:3001/api/v1",
      platforms: ["android"],
      runtimeVersion: "1.0",
    });

    await expect(loadConfig(root)).rejects.toBeInstanceOf(InvalidRuntimeVersionFormatError);
    await expect(loadConfig(root)).rejects.toThrow("semantic versioning");
  });

  describe("OPENOTA_SERVER_URL override", () => {
    afterEach(() => {
      delete process.env.OPENOTA_SERVER_URL;
    });

    it("overrides serverUrl from the config file when set", async () => {
      const config = buildDefaultConfig("http://localhost:3001/api/v1", "1.0.0");
      await writeConfig(root, config);

      process.env.OPENOTA_SERVER_URL = "https://openota.onrender.com/api/v1";

      const loaded = await loadConfig(root);
      expect(loaded.serverUrl).toBe("https://openota.onrender.com/api/v1");
    });

    it("rejects an invalid OPENOTA_SERVER_URL", async () => {
      const config = buildDefaultConfig("http://localhost:3001/api/v1", "1.0.0");
      await writeConfig(root, config);

      process.env.OPENOTA_SERVER_URL = "not-a-url";

      await expect(loadConfig(root)).rejects.toBeInstanceOf(ConfigValidationError);
    });

    it("leaves serverUrl untouched when the override is not set", async () => {
      const config = buildDefaultConfig("http://localhost:3001/api/v1", "1.0.0");
      await writeConfig(root, config);

      const loaded = await loadConfig(root);
      expect(loaded.serverUrl).toBe("http://localhost:3001/api/v1");
    });
  });
});
