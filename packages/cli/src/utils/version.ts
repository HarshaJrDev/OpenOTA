import path from "node:path";
import { fileURLToPath } from "node:url";

import fse from "fs-extra";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export function getCliVersion(): string {
  const pkgPath = path.join(currentDir, "..", "..", "package.json");
  const pkg = fse.readJsonSync(pkgPath) as { version: string };
  return pkg.version;
}

export function getNodeVersion(): string {
  return process.version.replace(/^v/, "");
}

export function getAppVersion(root: string = process.cwd()): string {
  const pkgPath = path.join(root, "package.json");
  const pkg = fse.readJsonSync(pkgPath) as { version?: string };
  return pkg.version ?? "0.0.0";
}

export function getReactNativeVersion(root: string = process.cwd()): string | null {
  const pkgPath = path.join(root, "node_modules", "react-native", "package.json");

  if (!fse.pathExistsSync(pkgPath)) {
    return null;
  }

  const pkg = fse.readJsonSync(pkgPath) as { version: string };
  return pkg.version;
}
