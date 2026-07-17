import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { StatTile } from '../components/StatTile';
import { StatusPill } from '../components/StatusPill';
import { forceCheck, refreshRuntimeInfo } from '../services/otaPlayground.service';
import { PLAYGROUND_CONFIG } from '../services/playgroundConfig';
import { usePlaygroundStore } from '../store/playgroundStore';
import { stateColors } from '../theme/theme';

const CONNECTION_LABEL: Record<string, { label: string; color: string }> = {
  unknown: { label: 'Unknown', color: '#9E9E9E' },
  checking: { label: 'Checking…', color: '#42A5F5' },
  online: { label: 'Online', color: '#43A047' },
  offline: { label: 'Offline', color: '#E53935' },
};

function formatMs(value: number | null): string {
  if (value === null) return '—';
  return `${value} ms`;
}

function formatTimestamp(value: number | null): string {
  if (value === null) return 'Never';
  return new Date(value).toLocaleTimeString();
}

export function DashboardScreen(): React.JSX.Element {
  const state = usePlaygroundStore();
  const [refreshing, setRefreshing] = useState(false);
  const { runtimeInfo, currentVersionInfo, timings, connectionStatus, lastSyncAt, lastInstallAt } = state;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshRuntimeInfo(), forceCheck()]);
    setRefreshing(false);
  }, []);

  const connection = CONNECTION_LABEL[connectionStatus];
  const runtimeState = runtimeInfo?.state ?? null;

  return (
    <Screen
      title="Dashboard"
      subtitle="A live snapshot of the OTA lifecycle for this device"
      onRefresh={onRefresh}
      refreshing={refreshing}>
      {!runtimeInfo ? (
        <EmptyState
          title="No runtime data yet"
          description="Pull to refresh, or make sure the native OpenOTA module is linked."
          actionLabel="Refresh now"
          onAction={onRefresh}
        />
      ) : (
        <>
          <View style={styles.statusRow}>
            <StatusPill label={connection.label} color={connection.color} />
            {runtimeState ? <StatusPill label={runtimeState} color={stateColors[runtimeState]} outlined /> : null}
          </View>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Bundle
          </Text>
          <View style={styles.grid}>
            <StatTile label="Current Bundle Version" value={runtimeInfo.currentVersion ?? runtimeInfo.bundleVersion ?? 'embedded'} />
            <StatTile label="Embedded Bundle Version" value={PLAYGROUND_CONFIG.embeddedBundleVersion} />
            <StatTile label="Runtime Version" value={runtimeInfo.runtimeVersion ?? '—'} />
            <StatTile label="Manifest Version" value={runtimeInfo.manifestVersion?.toString() ?? '—'} />
          </View>

          <Divider />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Runtime
          </Text>
          <View style={styles.grid}>
            <StatTile label="Current Runtime State" value={runtimeState ?? 'EMBEDDED'} accentColor={stateColors[runtimeState ?? 'EMBEDDED']} />
            <StatTile label="Current Bundle Path" value={runtimeInfo.bundlePath ?? currentVersionInfo?.bundlePath ?? 'embedded bundle'} />
            <StatTile label="Current Channel" value={PLAYGROUND_CONFIG.channel} />
            <StatTile label="Current Server" value={PLAYGROUND_CONFIG.serverUrl} />
          </View>

          <Divider />

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Sync history
          </Text>
          <View style={styles.grid}>
            <StatTile label="Last Sync" value={formatTimestamp(lastSyncAt)} />
            <StatTile label="Last Install" value={formatTimestamp(lastInstallAt)} />
          </View>

          <Text variant="titleSmall" style={styles.sectionTitle}>
            Timings
          </Text>
          <View style={styles.grid}>
            <StatTile label="Download Duration" value={formatMs(timings.downloadingMs)} />
            <StatTile label="Verification Duration" value={formatMs(timings.verifyingMs)} />
            <StatTile label="Activation Duration" value={formatMs(timings.installingMs)} />
            <StatTile label="Install Duration" value={formatMs(timings.installingMs)} />
          </View>

          <Button mode="outlined" onPress={onRefresh} style={styles.refreshButton}>
            Refresh dashboard
          </Button>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  refreshButton: {
    marginTop: 8,
  },
});
