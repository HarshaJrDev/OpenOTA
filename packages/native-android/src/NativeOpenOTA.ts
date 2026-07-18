import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

/**
 * Mirrors `RuntimeInfo` from `@openota/shared`, but declared inline: react-native-codegen parses
 * this file with its own Flow/Babel-based static analyzer (not tsc), and can't resolve types
 * imported from another package — every field the native `toWritableMap()` in `OpenOTAModule.kt`
 * produces must be spelled out here for codegen to generate correct JSI marshalling.
 */
export interface RuntimeInfo {
  currentVersion: string;
  bundleVersion: string;
  runtimeVersion: string;
  manifestVersion: number | null;
  bundlePath: string;
  installTime: number | null;
  platform: string;
  state: string;
}

export interface Spec extends TurboModule {
  setBundlePath(path: string): Promise<void>;
  getBundlePath(): Promise<string | null>;
  activateBundle(): Promise<RuntimeInfo>;
  rollback(): Promise<RuntimeInfo>;
  restart(): Promise<void>;
  clearBundle(): Promise<void>;
  getRuntimeInfo(): Promise<RuntimeInfo>;
}

export default TurboModuleRegistry.get<Spec>("OpenOTA");
