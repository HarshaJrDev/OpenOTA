import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';

import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { StateMachineDiagram } from '../components/StateMachineDiagram';
import { refreshRuntimeInfo } from '../services/otaPlayground.service';
import { usePlaygroundStore } from '../store/playgroundStore';

export function RuntimeInspectorScreen(): React.JSX.Element {
  const { runtimeInfo, busy } = usePlaygroundStore();
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRuntimeInfo();
    setRefreshing(false);
  }, []);

  return (
    <Screen
      title="Runtime Inspector"
      subtitle="Live view of the native runtime's state machine"
      onRefresh={onRefresh}
      refreshing={refreshing}>
      {!runtimeInfo ? (
        <EmptyState
          title="No runtime data yet"
          description="Refresh to fetch the native runtime's current state."
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      ) : (
        <>
          <Card mode="contained">
            <Card.Content style={styles.diagramCard}>
              <StateMachineDiagram active={runtimeInfo.state} />
            </Card.Content>
          </Card>

          <Card mode="outlined">
            <Card.Content style={styles.rawCard}>
              <Text variant="titleSmall">Raw RuntimeInfo</Text>
              <View style={[styles.rawBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="bodySmall" style={styles.mono}>
                  {JSON.stringify(runtimeInfo, null, 2)}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Button mode="outlined" onPress={onRefresh} loading={Boolean(busy.refresh)}>
            Refresh runtime info
          </Button>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  diagramCard: {
    paddingVertical: 24,
  },
  rawCard: {
    gap: 8,
  },
  rawBox: {
    borderRadius: 8,
    padding: 12,
  },
  mono: {
    fontFamily: 'monospace',
  },
});
