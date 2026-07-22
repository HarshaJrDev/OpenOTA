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

/**
 * Best-effort suggestion only, used by `openota init` to pre-fill `--runtime-version` — never
 * used to silently derive the value a build actually ships with. Android's `versionName` is a
 * reasonable *starting point* for a runtimeVersion (both are "native binary generation"
 * concepts), but the two are allowed to diverge deliberately, so this is never read again after
 * `init` writes the explicit value into openota.config.json.
 */
export function detectAndroidVersionName(root: string = process.cwd()): string | null {
  const buildGradlePath = path.join(root, "android", "app", "build.gradle");

  if (!fse.pathExistsSync(buildGradlePath)) {
    return null;
  }

  const contents = fse.readFileSync(buildGradlePath, "utf-8");
  const match = /versionName\s+["']([^"']+)["']/.exec(contents);
  return match?.[1] ?? null;
}
