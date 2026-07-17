import React, { useMemo, useState } from 'react';
import { FlatList, Share, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, useTheme } from 'react-native-paper';

import { EmptyState } from '../components/EmptyState';
import { LogRow } from '../components/LogRow';
import { exportLogs } from '../services/otaPlayground.service';
import { playgroundStore, usePlaygroundStore } from '../store/playgroundStore';
import type { LogSource } from '../store/types';

const SOURCES: Array<LogSource | 'all'> = ['all', 'sdk', 'native', 'server', 'app'];

export function LogsScreen(): React.JSX.Element {
  const { logs } = usePlaygroundStore();
  const [filter, setFilter] = useState<LogSource | 'all'>('all');
  const theme = useTheme();

  const filtered = useMemo(() => (filter === 'all' ? logs : logs.filter(log => log.source === filter)), [logs, filter]);

  const onExport = async () => {
    await Share.share({ message: exportLogs(), title: 'OpenOTA Playground logs' });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall">Logs</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Every event emitted by the SDK, the native runtime, and server responses relayed through it
        </Text>
      </View>

      <View style={styles.filterRow}>
        {SOURCES.map(source => (
          <Chip key={source} selected={filter === source} onPress={() => setFilter(source)} compact mode="outlined">
            {source}
          </Chip>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Button mode="text" onPress={() => playgroundStore.clearLogs()} compact>
          Clear
        </Button>
        <Button mode="text" onPress={onExport} compact>
          Export Logs
        </Button>
      </View>

      {filtered.length === 0 ? (
        <EmptyState glyph="≡" title="No logs yet" description="Trigger a check, sync, or any Developer Tools action to see events here." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <LogRow entry={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
    gap: 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexWrap: 'wrap',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});
