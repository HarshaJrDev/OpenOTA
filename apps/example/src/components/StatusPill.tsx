import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface Props {
  label: string;
  color: string;
  outlined?: boolean;
}

export function StatusPill({ label, color, outlined }: Props): React.JSX.Element {
  return (
    <View
      style={[
        styles.pill,
        outlined
          ? { borderColor: color, borderWidth: 1.5 }
          : { backgroundColor: `${color}26` },
      ]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="labelMedium" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
