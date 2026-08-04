import path from "node:path";

import fse from "fs-extra";

export type PackageManager = "npm" | "yarn" | "pnpm";

/** Lockfile presence is the same signal `npm create`/Expo/Vercel CLIs use — more reliable than checking which binary is on PATH, since a dev may have all three installed but only one lockfile per project. Defaults to npm when no lockfile exists yet (a fresh project). */
export function detectPackageManager(root: string): PackageManager {
  if (fse.pathExistsSync(path.join(root, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fse.pathExistsSync(path.join(root, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

export function installCommand(pm: PackageManager, deps: string[]): { command: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["add", ...deps] };
    case "yarn":
      return { command: "yarn", args: ["add", ...deps] };
    case "npm":
    default:
      return { command: "npm", args: ["install", ...deps] };
  }
}
