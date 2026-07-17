import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { LogEntry } from '../store/types';
import { logLevelColors, logSourceColors } from '../theme/theme';

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour12: false }) + `.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function LogRow({ entry }: { entry: LogEntry }): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
      <Text variant="labelSmall" style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}>
        {formatTime(entry.timestamp)}
      </Text>
      <View style={[styles.badge, { backgroundColor: `${logSourceColors[entry.source]}26` }]}>
        <Text variant="labelSmall" style={{ color: logSourceColors[entry.source] }}>
          {entry.source}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${logLevelColors[entry.level]}26` }]}>
        <Text variant="labelSmall" style={{ color: logLevelColors[entry.level] }}>
          {entry.level}
        </Text>
      </View>
      <Text variant="bodySmall" style={styles.message}>
        {entry.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  timestamp: {
    fontFamily: 'monospace',
    minWidth: 90,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  message: {
    flexBasis: '100%',
    marginTop: 2,
  },
});
