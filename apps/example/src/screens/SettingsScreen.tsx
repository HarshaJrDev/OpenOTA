import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';

import { Screen } from '../components/Screen';
import { PLAYGROUND_CONFIG } from '../services/playgroundConfig';
import { playgroundStore, usePlaygroundStore } from '../store/playgroundStore';
import type { ThemeMode } from '../store/types';

function ConfigRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="bodyMedium" selectable style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const { themeMode } = usePlaygroundStore();
  const [autoRestartNotice, setAutoRestartNotice] = React.useState(PLAYGROUND_CONFIG.autoRestart);

  return (
    <Screen title="Settings" subtitle="Appearance and connection configuration for this Playground">
      <Card mode="outlined">
        <Card.Content style={styles.section}>
          <Text variant="titleSmall">Appearance</Text>
          <SegmentedButtons
            value={themeMode}
            onValueChange={value => playgroundStore.setState({ themeMode: value as ThemeMode })}
            buttons={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.section}>
          <Text variant="titleSmall">Connection</Text>
          <ConfigRow label="Server URL" value={PLAYGROUND_CONFIG.serverUrl} />
          <ConfigRow label="Channel" value={PLAYGROUND_CONFIG.channel} />
          <ConfigRow label="Request timeout" value={`${PLAYGROUND_CONFIG.requestTimeout} ms`} />
          <Text variant="bodySmall" style={styles.note}>
            Edit src/services/playgroundConfig.ts and reload to point this Playground at a different
            OpenOTA server.
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.section}>
          <View style={styles.row}>
            <Text variant="bodyMedium">Auto-restart after install</Text>
            <Switch value={autoRestartNotice} onValueChange={setAutoRestartNotice} disabled />
          </View>
          <Text variant="bodySmall" style={styles.note}>
            Disabled by default in the Playground so you can observe each lifecycle stage before the
            JS bundle reloads — see the OTA Release Validation workflow in the About tab.
          </Text>
        </Card.Content>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  note: {
    opacity: 0.7,
  },
});
