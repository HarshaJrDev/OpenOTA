import {
  nativeActivateBundle,
  nativeClearBundle,
  nativeGetBundlePath,
  nativeGetFcmToken,
  nativeGetRuntimeInfo,
  nativeRegisterForPushNotifications,
  nativeRestart,
  nativeRollback,
  nativeSetBundlePath,
  type RuntimeInfo,
} from "./bridge.js";

function ensureFileScheme(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

export const iosBridge = {
  async getBundlePath(): Promise<string | null> {
    return nativeGetBundlePath();
  },

  async setBundlePath(path: string): Promise<void> {
    return nativeSetBundlePath(ensureFileScheme(path));
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

  async getFcmToken(): Promise<string | null> {
    return nativeGetFcmToken();
  },

  async registerForPushNotifications(): Promise<void> {
    return nativeRegisterForPushNotifications();
  },
};
