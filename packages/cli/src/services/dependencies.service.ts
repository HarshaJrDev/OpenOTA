import path from "node:path";

import { execa } from "execa";
import fse from "fs-extra";

import { detectPackageManager, installCommand } from "../utils/package-manager.js";

/** Returns the subset of `deps` not already declared in the project's package.json (dependencies or devDependencies) — installing an already-declared dep would risk overwriting a pinned version the user chose deliberately. */
export async function getMissingDeps(root: string, deps: readonly string[]): Promise<string[]> {
  const pkgJsonPath = path.join(root, "package.json");
  let pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkgJson = await fse.readJson(pkgJsonPath);
  } catch {
    return [...deps];
  }

  const declared = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  return deps.filter((dep) => !declared[dep]);
}

/** Shells out to the project's own detected package manager (npm/yarn/pnpm via lockfile) rather than assuming npm, so it doesn't create a second, conflicting lockfile in a yarn/pnpm project. */
export async function installDependencies(root: string, deps: string[]): Promise<void> {
  if (deps.length === 0) {
    return;
  }

  const pm = detectPackageManager(root);
  const { command, args } = installCommand(pm, deps);
  await execa(command, args, { cwd: root, timeout: 5 * 60_000 });
}
