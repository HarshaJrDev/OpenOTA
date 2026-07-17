import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, ProgressBar, Text, useTheme } from 'react-native-paper';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { forceCheck, forceSync } from '../services/otaPlayground.service';
import { usePlaygroundStore } from '../store/playgroundStore';

const STAGE_LABEL: Record<string, string> = {
  checking: 'Checking for updates…',
  downloading: 'Downloading package…',
  extracting: 'Extracting package…',
  verifying: 'Verifying checksum…',
  installing: 'Installing & activating…',
  done: 'Done',
};

export function UpdatesScreen(): React.JSX.Element {
  const { checkResult, syncStage, syncPercent, busy } = usePlaygroundStore();
  const theme = useTheme();

  const onCheck = useCallback(() => {
    void forceCheck();
  }, []);

  const onSync = useCallback(() => {
    void forceSync();
  }, []);

  const isSyncing = Boolean(busy.sync);

  return (
    <Screen title="Updates" subtitle="Check for and apply OTA updates via the SDK's public API">
      <Card mode="elevated">
        <Card.Content style={styles.syncCard}>
          <Text variant="titleMedium">Sync</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Runs check → download → extract → verify → install in one call, exactly what{' '}
            <Text style={styles.mono}>OTA.sync()</Text> does in a production app.
          </Text>

          {isSyncing && syncStage ? (
            <View style={styles.progress}>
              <Text variant="bodySmall">{STAGE_LABEL[syncStage] ?? syncStage}</Text>
              <ProgressBar
                progress={syncPercent !== null ? syncPercent / 100 : undefined}
                indeterminate={syncPercent === null}
                style={styles.progressBar}
              />
            </View>
          ) : null}

          <Button mode="contained" onPress={onSync} loading={isSyncing} disabled={isSyncing}>
            Press Sync
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.checkCard}>
          <View style={styles.checkHeader}>
            <Text variant="titleMedium">Latest check result</Text>
            <Button mode="text" onPress={onCheck} loading={Boolean(busy.check)} disabled={Boolean(busy.check)}>
              Force Check
            </Button>
          </View>

          {!checkResult ? (
            <EmptyState
              glyph="⬆"
              title="No check performed yet"
              description="Run a check to see whether a new bundle is available on the server."
              actionLabel="Check now"
              onAction={onCheck}
            />
          ) : checkResult.available && checkResult.manifest ? (
            <View style={styles.details}>
              <Chip mode="flat">v{checkResult.latestVersion}</Chip>
              <Text variant="bodyMedium">Platform: {checkResult.manifest.platform}</Text>
              <Text variant="bodyMedium">Runtime version: {checkResult.manifest.runtimeVersion}</Text>
              <Text variant="bodyMedium" numberOfLines={1}>
                SHA256: {checkResult.manifest.sha256}
              </Text>
              <Text variant="bodyMedium">Size: {checkResult.manifest.size.toLocaleString()} bytes</Text>
            </View>
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Up to date — latest published version is v{checkResult.latestVersion ?? 'unknown'}.
            </Text>
          )}
        </Card.Content>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  syncCard: {
    gap: 12,
  },
  checkCard: {
    gap: 8,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress: {
    gap: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  details: {
    gap: 6,
    alignItems: 'flex-start',
  },
  mono: {
    fontFamily: 'monospace',
  },
});
