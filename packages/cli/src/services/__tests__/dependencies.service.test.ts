import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMissingDeps } from "../dependencies.service.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cli-deps-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("dependencies.service", () => {
  it("returns all deps as missing when package.json doesn't exist", async () => {
    const missing = await getMissingDeps(root, ["react-native-fs", "react-native-mmkv"]);
    expect(missing).toEqual(["react-native-fs", "react-native-mmkv"]);
  });

  it("filters out deps already declared in dependencies", async () => {
    await fse.writeJson(path.join(root, "package.json"), {
      dependencies: { "react-native-fs": "^2.20.0" },
    });

    const missing = await getMissingDeps(root, ["react-native-fs", "react-native-mmkv"]);
    expect(missing).toEqual(["react-native-mmkv"]);
  });

  it("filters out deps already declared in devDependencies", async () => {
    await fse.writeJson(path.join(root, "package.json"), {
      devDependencies: { "@openota/cli": "^0.2.0" },
    });

    const missing = await getMissingDeps(root, ["@openota/cli", "@openota/sdk"]);
    expect(missing).toEqual(["@openota/sdk"]);
  });

  it("returns an empty array when everything is already declared", async () => {
    await fse.writeJson(path.join(root, "package.json"), {
      dependencies: { "react-native-fs": "^2.20.0", "react-native-mmkv": "^3.0.0" },
    });

    const missing = await getMissingDeps(root, ["react-native-fs", "react-native-mmkv"]);
    expect(missing).toEqual([]);
  });
});
