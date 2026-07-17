import type { CheckResult, CurrentVersionInfo, RuntimeInfo, SyncProgressStage } from '@openota/sdk';

export type LogSource = 'sdk' | 'native' | 'server' | 'app';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  source: LogSource;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface StageTimings {
  checkingMs: number | null;
  downloadingMs: number | null;
  extractingMs: number | null;
  verifyingMs: number | null;
  installingMs: number | null;
  totalMs: number | null;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface PlaygroundState {
  runtimeInfo: RuntimeInfo | null;
  currentVersionInfo: CurrentVersionInfo | null;
  checkResult: CheckResult | null;
  connectionStatus: 'unknown' | 'checking' | 'online' | 'offline';
  syncStage: SyncProgressStage | null;
  syncPercent: number | null;
  lastSyncAt: number | null;
  lastInstallAt: number | null;
  timings: StageTimings;
  logs: LogEntry[];
  busy: Partial<Record<string, boolean>>;
  themeMode: ThemeMode;
}

export const EMPTY_TIMINGS: StageTimings = {
  checkingMs: null,
  downloadingMs: null,
  extractingMs: null,
  verifyingMs: null,
  installingMs: null,
  totalMs: null,
};
