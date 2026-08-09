import type { RuntimeInfo } from "@openota/shared";
import { TurboModuleRegistry, type TurboModule } from "react-native";

export type { RuntimeInfo };

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

/**
 * Resolved lazily on every call rather than once at module-eval time: in the New Architecture's
 * bridgeless mode, JS can start executing (and a consumer's top-level `useEffect` can fire)
 * before the native TurboModuleManager has finished attaching. A single eager
 * `TurboModuleRegistry.get()` call — e.g. via `export default TurboModuleRegistry.get(...)` —
 * would permanently cache a `null` result from that early race, even though the module becomes
 * available moments later. Re-resolving per call costs nothing (the native side does its own
 * caching) and eliminates that whole class of "not linked" false negatives.
 */
export function getNativeOpenOTA(): Spec | null {
  return TurboModuleRegistry.get<Spec>("OpenOTA");
}
