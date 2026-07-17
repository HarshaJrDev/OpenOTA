import path from "node:path";

import axios from "axios";
import { execa } from "execa";
import fse from "fs-extra";

import type { DoctorCheckResult } from "../types/index.js";
import { getConfigPath, getProjectRoot, isReactNativeProject } from "../utils/paths.js";
import { getNodeVersion } from "../utils/version.js";
import { loadConfig } from "./config.service.js";

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

export async function runDoctorChecks(root: string = getProjectRoot()): Promise<DoctorCheckResult[]> {
  return [
    await checkNode(),
    await checkReactNative(root),
    await checkAndroid(root),
    await checkIos(root),
    await checkMetro(root),
    await checkConfig(root),
    await checkServerReachability(root),
  ];
}
