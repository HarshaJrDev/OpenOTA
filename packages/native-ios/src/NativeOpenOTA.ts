import type { RuntimeInfo } from "@openota/shared";
import { TurboModuleRegistry, type TurboModule } from "react-native";

export type { RuntimeInfo };

// Kept in sync 1:1 with packages/sdk/src/native/NativeOpenOTA.ts and
// packages/native-android/src/NativeOpenOTA.ts. This copy is what react-native's codegen parses
// out of *this* package (jsSrcsDir points here) to emit RCTOpenOTASpecJSI/NativeOpenOTASpec for
// iOS; the SDK's copy is what JS actually imports at runtime. Both must describe the exact same
// method surface or codegen output and the SDK's TurboModuleRegistry.get<Spec>("OpenOTA") call
// diverge silently.
export interface Spec extends TurboModule {
  setBundlePath(path: string): Promise<void>;
  getBundlePath(): Promise<string | null>;
  activateBundle(): Promise<RuntimeInfo>;
  rollback(): Promise<RuntimeInfo>;
  restart(): Promise<void>;
  clearBundle(): Promise<void>;
  getRuntimeInfo(): Promise<RuntimeInfo>;
  getFcmToken(): Promise<string | null>;
  registerForPushNotifications(): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>("OpenOTA");
