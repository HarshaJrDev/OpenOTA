import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';

interface Props {
  label: string;
  value: string;
  hint?: string;
  accentColor?: string;
}

export function StatTile({ label, value, hint, accentColor }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        <View style={styles.valueRow}>
          {accentColor ? <View style={[styles.dot, { backgroundColor: accentColor }]} /> : null}
          <Text variant="titleMedium" numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        </View>
        {hint ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {hint}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '45%',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  value: {
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
