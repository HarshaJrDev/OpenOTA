import React from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, MD3Theme, Text, useTheme } from 'react-native-paper';

import { Screen } from '../components/Screen';
import {
  exportRuntimeState,
  forceCheck,
  forceClearCache,
  forceDownloadVerifyExtract,
  forceInstall,
  forceResetRuntime,
  forceRestart,
  forceRollback,
} from '../services/otaPlayground.service';
import { usePlaygroundStore } from '../store/playgroundStore';

interface ActionDef {
  key: string;
  /** Key into the store's `busy` map — several UI actions share one underlying SDK call. */
  busyKey: string;
  label: string;
  description: string;
  onPress: () => void;
  destructive?: boolean;
}

export function DevToolsScreen(): React.JSX.Element {
  const { busy } = usePlaygroundStore();
  const theme = useTheme();

  const lifecycleActions: ActionDef[] = [
    {
      key: 'check',
      busyKey: 'check',
      label: 'Force Check',
      description: 'Calls OTA.check() against the configured server',
      onPress: () => void forceCheck(),
    },
    {
      key: 'download',
      busyKey: 'download',
      label: 'Force Download',
      description: 'Downloads, extracts and verifies the latest checked manifest',
      onPress: () => void forceDownloadVerifyExtract(),
    },
    {
      key: 'verify',
      busyKey: 'download',
      label: 'Force Verify',
      description: "The SDK verifies as part of download() — re-runs that pipeline and reports the checksum result",
      onPress: () => void forceDownloadVerifyExtract(),
    },
    {
      key: 'install',
      busyKey: 'install',
      label: 'Force Install',
      description: 'Downloads (if needed) and activates the latest checked manifest',
      onPress: () => void forceInstall(),
    },
    {
      key: 'restart',
      busyKey: 'restart',
      label: 'Force Restart',
      description: 'Reloads the JS bundle via the native runtime',
      onPress: () => void forceRestart(),
    },
  ];

  const recoveryActions: ActionDef[] = [
    {
      key: 'rollback',
      busyKey: 'rollback',
      label: 'Force Rollback',
      description: 'Restores the previous generation from the native rollback slot',
      onPress: () => void forceRollback(),
      destructive: true,
    },
    {
      key: 'reset',
      busyKey: 'reset',
      label: 'Reset Runtime',
      description: 'Wipes current/rollback/downloads/cache — back to the embedded bundle',
      onPress: () => confirmThen('Reset Runtime', 'This clears the active bundle and all rollback history.', forceResetRuntime),
      destructive: true,
    },
  ];

  const storageActions: ActionDef[] = [
    {
      key: 'deleteBundle',
      busyKey: 'reset',
      label: 'Delete Bundle',
      description: 'Same underlying operation as Reset Runtime — wipes the active native bundle',
      onPress: () => confirmThen('Delete Bundle', 'This clears the active bundle and all rollback history.', forceResetRuntime),
      destructive: true,
    },
    {
      key: 'deleteDownloads',
      busyKey: 'clearCache',
      label: 'Delete Downloads',
      description: "Clears the SDK's downloads/ staging directory",
      onPress: () => void forceClearCache(),
    },
    {
      key: 'deleteCache',
      busyKey: 'clearCache',
      label: 'Delete Cache',
      description: "Clears the SDK's cache/ directory",
      onPress: () => void forceClearCache(),
    },
  ];

  const exportActions: ActionDef[] = [
    {
      key: 'exportRuntime',
      busyKey: 'exportRuntime',
      label: 'Export Runtime State',
      description: 'Share a JSON snapshot of runtime info + timings',
      onPress: onExportRuntime,
    },
  ];

  function confirmThen(title: string, message: string, action: () => Promise<void>) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => void action() },
    ]);
  }

  async function onExportRuntime() {
    await Share.share({ message: exportRuntimeState(), title: 'OpenOTA runtime state' });
  }

  return (
    <Screen title="Developer Tools" subtitle="Directly drive every stage of the OTA lifecycle via @openota/sdk">
      <ActionGroup title="Lifecycle" actions={lifecycleActions} busy={busy} theme={theme} />
      <ActionGroup title="Recovery" actions={recoveryActions} busy={busy} theme={theme} />
      <ActionGroup title="Storage" actions={storageActions} busy={busy} theme={theme} />
      <ActionGroup title="Export" actions={exportActions} busy={busy} theme={theme} />
    </Screen>
  );
}

function ActionGroup({
  title,
  actions,
  busy,
  theme,
}: {
  title: string;
  actions: ActionDef[];
  busy: Partial<Record<string, boolean>>;
  theme: MD3Theme;
}): React.JSX.Element {
  return (
    <Card mode="outlined">
      <Card.Content style={styles.group}>
        <Text variant="titleSmall">{title}</Text>
        <Divider style={styles.divider} />
        {actions.map((action, index) => (
          <View key={action.key}>
            <View style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text variant="bodyMedium">{action.label}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {action.description}
                </Text>
              </View>
              <Button
                mode={action.destructive ? 'outlined' : 'contained-tonal'}
                textColor={action.destructive ? theme.colors.error : undefined}
                loading={Boolean(busy[action.busyKey])}
                onPress={action.onPress}
                compact>
                Run
              </Button>
            </View>
            {index < actions.length - 1 ? <Divider style={styles.divider} /> : null}
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 4,
  },
  divider: {
    marginVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
});
