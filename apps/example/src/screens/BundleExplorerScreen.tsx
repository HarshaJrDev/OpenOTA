import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, Text, useTheme } from 'react-native-paper';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { usePlaygroundStore } from '../store/playgroundStore';

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue} numberOfLines={2} selectable>
        {value}
      </Text>
    </View>
  );
}

export function BundleExplorerScreen(): React.JSX.Element {
  const { currentVersionInfo, checkResult, runtimeInfo } = usePlaygroundStore();

  const manifest = currentVersionInfo?.manifest ?? checkResult?.manifest ?? null;
  const manifestSource = currentVersionInfo?.manifest ? 'last installed by this app' : 'last server check';

  return (
    <Screen title="Bundle Explorer" subtitle="Inspect the manifest and bundle for the current package">
      {!manifest ? (
        <EmptyState
          title="No manifest available"
          description="Install a bundle or run a check from the Updates tab to inspect its manifest here."
        />
      ) : (
        <Card mode="outlined">
          <Card.Content style={styles.content}>
            <Text variant="labelSmall">Source: {manifestSource}</Text>
            <Divider />
            <Row label="Manifest Version" value={String(manifest.manifestVersion)} />
            <Row label="Bundle Version" value={manifest.bundleVersion} />
            <Row label="Platform" value={manifest.platform} />
            <Row label="Runtime Version" value={manifest.runtimeVersion} />
            <Row label="Bundle" value={manifest.bundleName} />
            <Row label="SHA256" value={manifest.sha256} />
            <Row label="Bundle Size" value={`${manifest.size.toLocaleString()} bytes`} />
            <Row label="Created At" value={manifest.createdAt} />
            <Row label="Download URL" value={manifest.downloadUrl ?? '—'} />
            <Row label="Filesystem Path" value={runtimeInfo?.bundlePath ?? currentVersionInfo?.bundlePath ?? '—'} />
            <Divider />
            <Text variant="labelMedium">Assets ({manifest.assets?.length ?? 0})</Text>
            {manifest.assets && manifest.assets.length > 0 ? (
              manifest.assets.map(asset => (
                <Text key={asset} variant="bodySmall" style={styles.asset} selectable>
                  {asset}
                </Text>
              ))
            ) : (
              <Text variant="bodySmall">No assets recorded in this manifest.</Text>
            )}
          </Card.Content>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  asset: {
    fontFamily: 'monospace',
  },
});
