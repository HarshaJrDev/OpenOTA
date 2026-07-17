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
}

export default TurboModuleRegistry.get<Spec>("OpenOTA");
