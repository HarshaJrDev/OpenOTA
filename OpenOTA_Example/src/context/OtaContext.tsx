import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OTA } from "@openota/sdk";
import type { CheckResult, CurrentVersionInfo, SyncProgressEvent, SyncResult } from "@openota/sdk";

import config from "../../openota.config.json";

export type OtaPhase = "idle" | "checking" | "downloading" | "extracting" | "verifying" | "installing" | "done" | "error";

interface OtaState {
  channel: string;
  runtimeVersion: string;
  currentVersion: CurrentVersionInfo | null;
  phase: OtaPhase;
  progressPercent: number | null;
  lastCheck: CheckResult | null;
  lastResult: SyncResult | null;
  lastError: string | null;
  updateAvailable: boolean;
  checkNow: () => Promise<void>;
  syncNow: () => Promise<void>;
  rollbackNow: () => Promise<void>;
  restartNow: () => Promise<void>;
}

const OtaContext = createContext<OtaState | undefined>(undefined);

// One-time, module-level configure() — real values from openota.config.json, pointed at the live
// OpenOTA Cloud server. Everything this app shows/does from here on is driven by what that server
// returns; release/channel management itself happens on the OpenOTA Dashboard, not in this app.
OTA.configure({
  serverUrl: config.serverUrl,
  projectId: config.projectId,
  channel: "production",
  autoRestart: false, // let the UI show a clear "Update ready — restart" state first
});

export function OtaProvider({ children }: { children: React.ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState<CurrentVersionInfo | null>(null);
  const [phase, setPhase] = useState<OtaPhase>("idle");
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<CheckResult | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    setCurrentVersion(OTA.getCurrentVersion());
    // Live updates: the server nudges this connection the instant a new release/rollback/rollout
    // change happens on this device's channel, instead of waiting for a manual check.
    OTA.connectLive(() => setUpdateAvailable(true));
    return () => OTA.disconnectLive();
  }, []);

  const checkNow = useCallback(async () => {
    setPhase("checking");
    setLastError(null);
    try {
      const result = await OTA.check();
      setLastCheck(result);
      setUpdateAvailable(result.available);
      setPhase("idle");
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Check failed");
      setPhase("error");
    }
  }, []);

  const syncNow = useCallback(async () => {
    setLastError(null);
    setProgressPercent(null);
    const onProgress = (event: SyncProgressEvent) => {
      setPhase(event.stage as OtaPhase);
      setProgressPercent(event.percent ?? null);
    };
    try {
      const result = await OTA.sync(onProgress);
      setLastResult(result);
      setUpdateAvailable(false);
      setPhase("done");
      setCurrentVersion(OTA.getCurrentVersion());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Update failed");
      setPhase("error");
    }
  }, []);

  const rollbackNow = useCallback(async () => {
    setLastError(null);
    setPhase("installing");
    try {
      await OTA.rollback();
      setPhase("done");
      setCurrentVersion(OTA.getCurrentVersion());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Rollback failed");
      setPhase("error");
    }
  }, []);

  const restartNow = useCallback(async () => {
    await OTA.restart();
  }, []);

  const value = useMemo<OtaState>(
    () => ({
      channel: "production",
      runtimeVersion: config.runtimeVersion,
      currentVersion,
      phase,
      progressPercent,
      lastCheck,
      lastResult,
      lastError,
      updateAvailable,
      checkNow,
      syncNow,
      rollbackNow,
      restartNow,
    }),
    [currentVersion, phase, progressPercent, lastCheck, lastResult, lastError, updateAvailable, checkNow, syncNow, rollbackNow, restartNow],
  );

  return <OtaContext.Provider value={value}>{children}</OtaContext.Provider>;
}

export function useOta(): OtaState {
  const ctx = useContext(OtaContext);
  if (!ctx) throw new Error("useOta must be used within OtaProvider");
  return ctx;
}
