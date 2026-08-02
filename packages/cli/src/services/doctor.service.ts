import path from "node:path";

import axios from "axios";
import { execa } from "execa";
import fse from "fs-extra";

import type { DoctorCheckResult } from "../types/index.js";
import { getConfigPath, getProjectRoot, isReactNativeProject } from "../utils/paths.js";
import { getNodeVersion } from "../utils/version.js";
import { loadConfig } from "./config.service.js";
import { credentialsFileMode, getApiKey } from "./credentials.service.js";
import { resolveProjectFromKey } from "./project.service.js";

async function checkNode(): Promise<DoctorCheckResult> {
  const version = getNodeVersion();
  const major = Number(version.split(".")[0]);
  const ok = major >= 22;

  return {
    name: "Node.js",
    ok,
    message: ok ? `v${version}` : `v${version} (requires >= 22)`,
  };
}

async function checkReactNative(root: string): Promise<DoctorCheckResult> {
  const ok = isReactNativeProject(root);
  return {
    name: "React Native",
    ok,
    message: ok ? "detected in package.json" : "react-native dependency not found",
  };
}

async function checkAndroid(root: string): Promise<DoctorCheckResult> {
  const ok = await fse.pathExists(path.join(root, "android"));
  return {
    name: "Android",
    ok,
    message: ok ? "android/ directory found" : "android/ directory not found",
  };
}

async function checkIos(root: string): Promise<DoctorCheckResult> {
  const ok = await fse.pathExists(path.join(root, "ios"));
  return {
    name: "iOS",
    ok,
    message: ok ? "ios/ directory found" : "ios/ directory not found",
  };
}

const SDK_NATIVE_DEPS = ["react-native-mmkv", "react-native-fs", "react-native-zip-archive", "react-native-quick-crypto"];

/**
 * @openota/sdk depends on a handful of native modules (see docs "Native dependencies"). Being in
 * package.json is necessary but not sufficient — iOS also needs `pod install` to have actually
 * run against the current lockfile, or the JS-visible package exists while the native binary
 * doesn't have it linked. That gap is what produces the classic "Cannot read property 'otaStorage'
 * of undefined" crash the moment OTA.configure()/sync() runs, since it looks like a normal JS
 * error with no hint that the fix is a native rebuild, not a code change.
 */
async function checkNativeDeps(root: string): Promise<DoctorCheckResult> {
  const pkgJsonPath = path.join(root, "package.json");
  let pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkgJson = await fse.readJson(pkgJsonPath);
  } catch {
    return { name: "SDK Native Dependencies", ok: false, message: "could not read package.json" };
  }

  const declared = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  const missing = SDK_NATIVE_DEPS.filter((dep) => !declared[dep]);
  if (missing.length > 0) {
    return {
      name: "SDK Native Dependencies",
      ok: false,
      message: `missing from package.json: ${missing.join(", ")} (npm install ${missing.join(" ")})`,
    };
  }

  const podfileLockPath = path.join(root, "ios", "Podfile.lock");
  if (await fse.pathExists(path.join(root, "ios"))) {
    if (!(await fse.pathExists(podfileLockPath))) {
      return {
        name: "SDK Native Dependencies",
        ok: false,
        message: "declared in package.json, but ios/Podfile.lock doesn't exist — run `cd ios && pod install`",
      };
    }

    const podfileLock = await fse.readFile(podfileLockPath, "utf-8");
    const notLinked = SDK_NATIVE_DEPS.filter((dep) => !podfileLock.includes(dep));
    if (notLinked.length > 0) {
      return {
        name: "SDK Native Dependencies",
        ok: false,
        message: `declared in package.json but not in ios/Podfile.lock (stale pods): ${notLinked.join(", ")} — run \`cd ios && pod install\``,
      };
    }
  }

  return { name: "SDK Native Dependencies", ok: true, message: "all present and linked" };
}

async function checkMetro(root: string): Promise<DoctorCheckResult> {
  try {
    await execa("npx", ["react-native", "--version"], { cwd: root, timeout: 15_000 });
    return { name: "Metro", ok: true, message: "react-native CLI available" };
  } catch {
    return { name: "Metro", ok: false, message: "react-native CLI not available via npx" };
  }
}

async function checkConfig(root: string): Promise<DoctorCheckResult> {
  const ok = await fse.pathExists(getConfigPath(root));
  return {
    name: "OpenOTA Config",
    ok,
    message: ok ? "openota.config.json found" : "openota.config.json missing (run `openota init`)",
  };
}

/** Never logs/prints the key itself — only whether one is present and the credentials file's permission mode. */
async function checkAuthentication(root: string): Promise<DoctorCheckResult> {
  try {
    const config = await loadConfig(root);

    if (config.apiKey) {
      return {
        name: "Authentication",
        ok: false,
        message:
          "openota.config.json still has a legacy \"apiKey\" field — remove it and run `openota login --api-key <key>` instead (it now lives outside the project repo)",
      };
    }

    const apiKey = await getApiKey(config.serverUrl);
    if (!apiKey) {
      return { name: "Authentication", ok: false, message: "not logged in (run `openota login --api-key <key>`)" };
    }

    const mode = await credentialsFileMode();
    if (mode !== undefined && mode !== 0o600) {
      return {
        name: "Authentication",
        ok: false,
        message: `credentials file has overly permissive mode ${mode.toString(8)} (expected 600)`,
      };
    }

    return { name: "Authentication", ok: true, message: "logged in" };
  } catch {
    return { name: "Authentication", ok: false, message: "openota.config.json missing (run `openota init`)" };
  }
}

async function checkServerReachability(root: string): Promise<DoctorCheckResult> {
  try {
    const config = await loadConfig(root);
    const baseUrl = config.serverUrl.replace(/\/api\/v1\/?$/, "");
    const res = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    const ok = res.status === 200 && res.data?.success === true;
    return {
      name: "Server Reachability",
      ok,
      message: ok ? `reachable at ${config.serverUrl}` : "unexpected response from server",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { name: "Server Reachability", ok: false, message: `unreachable (${message})` };
  }
}

/** Only meaningful for OpenOTA Cloud (a project-scoped key) — self-hosted setups with no projectId skip this. */
async function checkProjectAccess(root: string): Promise<DoctorCheckResult | undefined> {
  const config = await loadConfig(root).catch(() => undefined);
  if (!config?.projectId) {
    return undefined;
  }

  const apiKey = await getApiKey(config.serverUrl);
  if (!apiKey) {
    return { name: "Project Access", ok: false, message: "not logged in (run `openota login --api-key <key>`)" };
  }

  const project = await resolveProjectFromKey(config.serverUrl, apiKey);
  if (!project) {
    return { name: "Project Access", ok: false, message: "API key did not resolve to a project (check it hasn't been revoked)" };
  }

  if (project.id !== config.projectId) {
    return {
      name: "Project Access",
      ok: false,
      message: `API key belongs to project "${project.name}" (${project.id}), not the configured ${config.projectId}`,
    };
  }

  return { name: "Project Access", ok: true, message: `"${project.name}" (${project.id})` };
}

export async function runDoctorChecks(root: string = getProjectRoot()): Promise<DoctorCheckResult[]> {
  const results = [
    await checkNode(),
    await checkReactNative(root),
    await checkAndroid(root),
    await checkIos(root),
    await checkNativeDeps(root),
    await checkMetro(root),
    await checkConfig(root),
    await checkAuthentication(root),
    await checkServerReachability(root),
  ];

  const projectAccess = await checkProjectAccess(root);
  if (projectAccess) {
    results.push(projectAccess);
  }

  return results;
}
