import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fse from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const installDependencies = vi.fn();
vi.mock("../dependencies.service.js", async () => {
  const actual = await vi.importActual<typeof import("../dependencies.service.js")>("../dependencies.service.js");
  return { ...actual, installDependencies };
});

const { runDoctorFix } = await import("../doctor.service.js");

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "openota-cli-doctor-fix-test-"));
  installDependencies.mockReset();
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("runDoctorFix", () => {
  it("reports nothing to fix when package.json already declares all SDK native deps", async () => {
    await fse.writeJson(path.join(root, "package.json"), {
      dependencies: {
        "react-native-mmkv": "^3.0.0",
        "react-native-fs": "^2.20.0",
        "react-native-zip-archive": "^7.0.0",
        "react-native-quick-crypto": "^0.7.0",
        "react-native-quick-base64": "^2.0.0",
        "react-native-nitro-modules": "^0.20.0",
      },
    });

    const result = await runDoctorFix(root);

    expect(result.fixed).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(installDependencies).not.toHaveBeenCalled();
  });

  it("installs missing SDK native deps and reports them as fixed", async () => {
    await fse.writeJson(path.join(root, "package.json"), { dependencies: {} });
    installDependencies.mockResolvedValue(undefined);

    const result = await runDoctorFix(root);

    expect(installDependencies).toHaveBeenCalledTimes(1);
    expect(result.fixed).toHaveLength(1);
    expect(result.fixed[0]).toContain("react-native-mmkv");
    expect(result.failed).toEqual([]);
  });

  it("reports a failure instead of throwing when install fails", async () => {
    await fse.writeJson(path.join(root, "package.json"), { dependencies: {} });
    installDependencies.mockRejectedValue(new Error("network error"));

    const result = await runDoctorFix(root);

    expect(result.fixed).toEqual([]);
    expect(result.failed).toEqual([{ name: "SDK Native Dependencies", message: "network error" }]);
  });
});
