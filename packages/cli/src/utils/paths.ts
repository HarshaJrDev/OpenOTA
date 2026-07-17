import path from "node:path";

import fse from "fs-extra";

import { CONFIG_FILENAME } from "../constants/index.js";

export function getProjectRoot(): string {
  return process.cwd();
}

export function getConfigPath(root: string = getProjectRoot()): string {
  return path.join(root, CONFIG_FILENAME);
}

export async function configExists(root: string = getProjectRoot()): Promise<boolean> {
  return fse.pathExists(getConfigPath(root));
}

export function isReactNativeProject(root: string = getProjectRoot()): boolean {
  const pkgPath = path.join(root, "package.json");

  if (!fse.pathExistsSync(pkgPath)) {
    return false;
  }

  const pkg = fse.readJsonSync(pkgPath) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return Boolean(pkg.dependencies?.["react-native"] ?? pkg.devDependencies?.["react-native"]);
}

export function getBuildOutputDir(bundleOutput: string, root: string = getProjectRoot()): string {
  return path.resolve(root, bundleOutput);
}

export function getVersionOutputDir(
  bundleOutput: string,
  platform: string,
  version: string,
  root: string = getProjectRoot(),
): string {
  return path.join(getBuildOutputDir(bundleOutput, root), platform, version);
}
