import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildDefaultConfig, ConfigNotFoundError, ConfigValidationError, loadConfig, writeConfig } from "../config.service.js";

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
    const config = buildDefaultConfig("http://localhost:3001/api/v1");
    await writeConfig(root, config);

    const loaded = await loadConfig(root);
    expect(loaded).toEqual(config);
  });

  it("rejects an invalid config", async () => {
    await fse.writeJson(path.join(root, "openota.config.json"), { serverUrl: "not-a-url" });
    await expect(loadConfig(root)).rejects.toBeInstanceOf(ConfigValidationError);
  });
});
