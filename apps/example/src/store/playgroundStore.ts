import { useSyncExternalStore } from 'react';

import type { LogEntry, LogLevel, LogSource, PlaygroundState } from './types';
import { EMPTY_TIMINGS } from './types';

let state: PlaygroundState = {
  runtimeInfo: null,
  currentVersionInfo: null,
  checkResult: null,
  connectionStatus: 'unknown',
  syncStage: null,
  syncPercent: null,
  lastSyncAt: null,
  lastInstallAt: null,
  timings: { ...EMPTY_TIMINGS },
  logs: [],
  busy: {},
  themeMode: 'system',
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(patch: Partial<PlaygroundState>): void {
  state = { ...state, ...patch };
  emit();
}

const MAX_LOGS = 500;
let logCounter = 0;

function pushLog(source: LogSource, level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  logCounter += 1;
  const entry: LogEntry = { id: `${Date.now()}-${logCounter}`, timestamp: Date.now(), source, level, message, meta };
  const logs = [entry, ...state.logs].slice(0, MAX_LOGS);
  setState({ logs });
}

function clearLogs(): void {
  setState({ logs: [] });
}

function setBusy(key: string, value: boolean): void {
  setState({ busy: { ...state.busy, [key]: value } });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PlaygroundState {
  return state;
}

export const playgroundStore = {
  subscribe,
  getSnapshot,
  setState,
  pushLog,
  clearLogs,
  setBusy,
  resetTimings(): void {
    setState({ timings: { ...EMPTY_TIMINGS } });
  },
};

export function usePlaygroundStore(): PlaygroundState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
