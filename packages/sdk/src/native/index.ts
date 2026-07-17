import { Platform } from "react-native";

import { androidBridge } from "./android.js";
import { iosBridge } from "./ios.js";
import type { RuntimeInfo } from "./bridge.js";

export type { RuntimeInfo };

export interface NativeBridge {
  getBundlePath(): Promise<string | null>;
  setBundlePath(path: string): Promise<void>;
  activateBundle(): Promise<RuntimeInfo>;
  rollback(): Promise<RuntimeInfo>;
  restart(): Promise<void>;
  clearBundle(): Promise<void>;
  getRuntimeInfo(): Promise<RuntimeInfo>;
}

export const nativeBridge: NativeBridge = Platform.OS === "android" ? androidBridge : iosBridge;
