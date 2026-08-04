import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectPackageManager, installCommand } from "../package-manager.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cli-pm-test-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("detectPackageManager", () => {
  it("defaults to npm when no lockfile exists", () => {
    expect(detectPackageManager(root)).toBe("npm");
  });

  it("detects pnpm from pnpm-lock.yaml", async () => {
    await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(root)).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", async () => {
    await fs.writeFile(path.join(root, "yarn.lock"), "");
    expect(detectPackageManager(root)).toBe("yarn");
  });

  it("prefers pnpm over yarn when both lockfiles exist", async () => {
    await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "");
    await fs.writeFile(path.join(root, "yarn.lock"), "");
    expect(detectPackageManager(root)).toBe("pnpm");
  });
});

describe("installCommand", () => {
  it("builds npm install", () => {
    expect(installCommand("npm", ["react-native-fs"])).toEqual({
      command: "npm",
      args: ["install", "react-native-fs"],
    });
  });

  it("builds yarn add", () => {
    expect(installCommand("yarn", ["react-native-fs"])).toEqual({
      command: "yarn",
      args: ["add", "react-native-fs"],
    });
  });

  it("builds pnpm add", () => {
    expect(installCommand("pnpm", ["react-native-fs"])).toEqual({
      command: "pnpm",
      args: ["add", "react-native-fs"],
    });
  });
});
