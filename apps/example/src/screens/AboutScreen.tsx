import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

import { Screen } from '../components/Screen';

const CHANGE_LOG = ['Real iOS OTA E2E test', 'Text change confirmed', 'FlatList confirmed', 'Background color confirmed'];

const STEPS = [
  { title: 'Run openota release', detail: 'From your React Native app: builds, bundles, and uploads a new package to your OpenOTA server.' },
  { title: 'Open this application', detail: 'Launch the Playground on a device or emulator pointed at that same server.' },
  { title: 'Press Sync', detail: 'Go to the Updates tab and press Sync — this calls OTA.sync() end to end.' },
  { title: 'Observe state transitions', detail: 'Watch the Runtime Inspector and Logs tabs as the bundle moves through Downloaded → Verified → Extracted → Installed → Activated.' },
  { title: 'Observe restart', detail: 'If auto-restart is enabled, the JS bundle reloads automatically; otherwise press "Force Restart" in Developer Tools.' },
  { title: 'Confirm UI changes', detail: 'Check the Dashboard — Current Bundle Version should now match the version you released.' },
];

export function AboutScreen(): React.JSX.Element {
  const theme = useTheme();

  return (
    <Screen title="About" subtitle="What this app is, and how to validate a release end to end">
      <Card mode="outlined" style={{ backgroundColor: '#0B3D2E' }}>
        <Card.Content style={styles.section}>
          <Text variant="titleSmall" style={{ color: '#FFFFFF' }}>
            OpenOTA Developer Playground [iOS OTA E2E Test - After]
          </Text>
          <Text variant="bodyMedium" style={{ color: '#D7F5E8' }}>
            The canonical application used by OpenOTA maintainers, contributors, CI, documentation,
            QA, and bug reports to observe the entire OTA lifecycle. Every screen in this app is
            backed exclusively by <Text style={styles.mono}>@openota/sdk</Text> — it never calls a
            backend API directly.
          </Text>
          <FlatList
            data={CHANGE_LOG}
            keyExtractor={(item) => item}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Text variant="bodySmall" style={{ color: '#D7F5E8' }}>
                • {item}
              </Text>
            )}
          />
        </Card.Content>
      </Card>

      <Card mode="elevated">
        <Card.Content style={styles.section}>
          <Text variant="titleSmall">OTA Release Validation workflow</Text>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={[styles.stepBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer }}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.stepText}>
                <Text variant="bodyMedium" style={styles.stepTitle}>
                  {step.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {step.detail}
                </Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.section}>
          <Text variant="titleSmall">Networking policy</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            This app never imports axios/fetch against the OpenOTA server directly. Every network
            call and every native runtime call is routed through the public{' '}
            <Text style={styles.mono}>OTA</Text> facade in{' '}
            <Text style={styles.mono}>@openota/sdk</Text> — the same contract any production app
            would use.
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
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontWeight: '600',
  },
  mono: {
    fontFamily: 'monospace',
  },
  changeRow: {
    paddingVertical: 4,
  },
});
