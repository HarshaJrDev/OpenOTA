import { OTA, OTAError, setLogHandler, type LogLevel as SdkLogLevel } from '@openota/sdk';

import { playgroundStore } from '../store/playgroundStore';
import { EMPTY_TIMINGS } from '../store/types';
import { PLAYGROUND_CONFIG } from './playgroundConfig';

let initialized = false;

/**
 * The single seam between this app and the OTA lifecycle. Every screen reads state from
 * `playgroundStore` and calls these functions — nothing in this app talks to a backend directly,
 * and nothing calls the native bridge directly either. `@openota/sdk`'s public `OTA` facade is the
 * only networking/native surface this app is allowed to touch.
 */
export function initOtaPlayground(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  OTA.configure({
    serverUrl: PLAYGROUND_CONFIG.serverUrl,
    channel: PLAYGROUND_CONFIG.channel,
    autoRestart: PLAYGROUND_CONFIG.autoRestart,
    requestTimeout: PLAYGROUND_CONFIG.requestTimeout,
  });

  // The SDK's own internal log lines (network calls, storage cache writes) surface here.
  setLogHandler((level: SdkLogLevel, message: string, meta?: Record<string, unknown>) => {
    playgroundStore.pushLog('sdk', level, message, meta);
  });

  playgroundStore.pushLog('app', 'info', `Configured for ${PLAYGROUND_CONFIG.serverUrl}`);
  void refreshRuntimeInfo();
}

function describeError(error: unknown): { message: string; meta?: Record<string, unknown> } {
  if (error instanceof OTAError) {
    return { message: error.message, meta: { code: error.code } };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

async function withBusy<T>(key: string, action: () => Promise<T>): Promise<T> {
  playgroundStore.setBusy(key, true);
  try {
    return await action();
  } finally {
    playgroundStore.setBusy(key, false);
  }
}

export async function refreshRuntimeInfo(): Promise<void> {
  await withBusy('refresh', async () => {
    try {
      const [runtimeInfo, currentVersionInfo] = await Promise.all([
        OTA.getRuntimeInfo(),
        Promise.resolve(OTA.getCurrentVersion()),
      ]);
      playgroundStore.setState({ runtimeInfo, currentVersionInfo });
      playgroundStore.pushLog('native', 'debug', 'Fetched runtime info', { ...runtimeInfo });
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('native', 'error', `Failed to read runtime info: ${message}`, meta);
    }
  });
}

export async function forceCheck(): Promise<void> {
  await withBusy('check', async () => {
    playgroundStore.setState({ connectionStatus: 'checking' });
    const startedAt = Date.now();

    try {
      const result = await OTA.check();
      playgroundStore.setState({
        checkResult: result,
        connectionStatus: 'online',
        timings: { ...playgroundStore.getSnapshot().timings, checkingMs: Date.now() - startedAt },
      });
      playgroundStore.pushLog(
        'server',
        'info',
        result.available
          ? `Update available: v${result.latestVersion}`
          : `Up to date (latest v${result.latestVersion ?? 'unknown'})`,
        { ...result },
      );
    } catch (error) {
      playgroundStore.setState({ connectionStatus: 'offline' });
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('server', 'error', `Check failed: ${message}`, meta);
    }
  });
}

export async function forceDownloadVerifyExtract(): Promise<void> {
  await withBusy('download', async () => {
    const startedAt = Date.now();
    const check = playgroundStore.getSnapshot().checkResult;

    try {
      const extracted = await OTA.download(check?.manifest ?? undefined, percent => {
        playgroundStore.setState({ syncStage: 'downloading', syncPercent: percent });
      });

      playgroundStore.setState({
        syncStage: 'done',
        syncPercent: null,
        timings: {
          ...playgroundStore.getSnapshot().timings,
          downloadingMs: Date.now() - startedAt,
        },
      });
      playgroundStore.pushLog('sdk', 'info', `Downloaded, extracted and verified v${extracted.manifest.bundleVersion}`, {
        bundlePath: extracted.bundlePath,
        sha256: extracted.manifest.sha256,
      });
    } catch (error) {
      playgroundStore.setState({ syncStage: null, syncPercent: null });
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('sdk', 'error', `Download/verify failed: ${message}`, meta);
    }
  });
}

export async function forceInstall(): Promise<void> {
  await withBusy('install', async () => {
    const startedAt = Date.now();

    try {
      const check = playgroundStore.getSnapshot().checkResult;
      if (!check?.manifest) {
        throw new OTAError('NO_UPDATE_AVAILABLE', 'Run "Force Check" and "Force Download" first');
      }

      const extracted = await OTA.download(check.manifest);
      const result = await OTA.install(extracted);

      playgroundStore.setState({
        lastInstallAt: Date.now(),
        timings: { ...playgroundStore.getSnapshot().timings, installingMs: Date.now() - startedAt },
      });
      playgroundStore.pushLog('native', 'info', `Installed v${result.version ?? 'unknown'}`, {
        bundlePath: result.bundlePath,
      });
      await refreshRuntimeInfo();
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('native', 'error', `Install failed: ${message}`, meta);
    }
  });
}

export async function forceSync(): Promise<void> {
  await withBusy('sync', async () => {
    const startedAt = Date.now();
    playgroundStore.resetTimings();
    let stageStartedAt = startedAt;

    try {
      const result = await OTA.sync(event => {
        const now = Date.now();
        const elapsed = now - stageStartedAt;
        stageStartedAt = now;

        playgroundStore.setState({ syncStage: event.stage, syncPercent: event.percent ?? null });

        const timings = playgroundStore.getSnapshot().timings;
        if (event.stage === 'checking') return;
        if (event.stage === 'downloading' && event.percent === undefined) return;

        if (event.stage === 'extracting') playgroundStore.setState({ timings: { ...timings, downloadingMs: elapsed } });
        if (event.stage === 'verifying') playgroundStore.setState({ timings: { ...timings, extractingMs: elapsed } });
        if (event.stage === 'installing') playgroundStore.setState({ timings: { ...timings, verifyingMs: elapsed } });
        if (event.stage === 'done') playgroundStore.setState({ timings: { ...timings, installingMs: elapsed } });
      });

      const totalMs = Date.now() - startedAt;
      playgroundStore.setState({
        lastSyncAt: Date.now(),
        lastInstallAt: result.status !== 'up-to-date' ? Date.now() : playgroundStore.getSnapshot().lastInstallAt,
        timings: { ...playgroundStore.getSnapshot().timings, totalMs },
        syncStage: null,
        syncPercent: null,
      });
      playgroundStore.pushLog('sdk', 'info', `Sync complete: ${result.status}`, { ...result });
      await refreshRuntimeInfo();
    } catch (error) {
      playgroundStore.setState({ syncStage: null, syncPercent: null, timings: { ...EMPTY_TIMINGS } });
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('sdk', 'error', `Sync failed: ${message}`, meta);
    }
  });
}

export async function forceRestart(): Promise<void> {
  await withBusy('restart', async () => {
    try {
      playgroundStore.pushLog('native', 'warn', 'Requesting JS bundle reload…');
      await OTA.restart();
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('native', 'error', `Restart failed: ${message}`, meta);
    }
  });
}

export async function forceRollback(): Promise<void> {
  await withBusy('rollback', async () => {
    try {
      const result = await OTA.rollback();
      playgroundStore.pushLog('native', 'warn', `Rolled back to v${result.version ?? 'unknown'}`, {
        bundlePath: result.bundlePath,
      });
      await refreshRuntimeInfo();
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('native', 'error', `Rollback failed: ${message}`, meta);
    }
  });
}

export async function forceClearCache(): Promise<void> {
  await withBusy('clearCache', async () => {
    try {
      await OTA.clearCache();
      playgroundStore.pushLog('app', 'info', 'Cleared downloads and cache directories');
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('app', 'error', `Clear cache failed: ${message}`, meta);
    }
  });
}

export async function forceResetRuntime(): Promise<void> {
  await withBusy('reset', async () => {
    try {
      await OTA.resetRuntime();
      playgroundStore.setState({
        checkResult: null,
        lastSyncAt: null,
        lastInstallAt: null,
        timings: { ...EMPTY_TIMINGS },
      });
      playgroundStore.pushLog('native', 'warn', 'Runtime reset — serving embedded bundle');
      await refreshRuntimeInfo();
    } catch (error) {
      const { message, meta } = describeError(error);
      playgroundStore.pushLog('native', 'error', `Reset failed: ${message}`, meta);
    }
  });
}

export function exportRuntimeState(): string {
  const snapshot = playgroundStore.getSnapshot();
  return JSON.stringify(
    {
      runtimeInfo: snapshot.runtimeInfo,
      currentVersionInfo: snapshot.currentVersionInfo,
      checkResult: snapshot.checkResult,
      timings: snapshot.timings,
      lastSyncAt: snapshot.lastSyncAt,
      lastInstallAt: snapshot.lastInstallAt,
      config: PLAYGROUND_CONFIG,
    },
    null,
    2,
  );
}

export function exportLogs(): string {
  return JSON.stringify(playgroundStore.getSnapshot().logs, null, 2);
}
