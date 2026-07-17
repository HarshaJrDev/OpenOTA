import {
  nativeActivateBundle,
  nativeClearBundle,
  nativeGetBundlePath,
  nativeGetRuntimeInfo,
  nativeRestart,
  nativeRollback,
  nativeSetBundlePath,
  type RuntimeInfo,
} from "./bridge.js";

function stripFileScheme(path: string): string {
  return path.startsWith("file://") ? path.slice("file://".length) : path;
}

export const androidBridge = {
  async getBundlePath(): Promise<string | null> {
    return nativeGetBundlePath();
  },

  async setBundlePath(path: string): Promise<void> {
    return nativeSetBundlePath(stripFileScheme(path));
  },

  async activateBundle(): Promise<RuntimeInfo> {
    return nativeActivateBundle();
  },

  async rollback(): Promise<RuntimeInfo> {
    return nativeRollback();
  },

  async restart(): Promise<void> {
    return nativeRestart();
  },

  async clearBundle(): Promise<void> {
    return nativeClearBundle();
  },

  async getRuntimeInfo(): Promise<RuntimeInfo> {
    return nativeGetRuntimeInfo();
  },
};
