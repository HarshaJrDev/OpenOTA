import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { SECTIONS, type PlaygroundSection } from './sections';

interface Props {
  active: PlaygroundSection;
  onSelect: (section: PlaygroundSection) => void;
}

export function TabStrip({ active, onSelect }: Props): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {SECTIONS.map(section => {
          const isActive = section.key === active;
          return (
            <TouchableOpacity
              key={section.key}
              onPress={() => onSelect(section.key)}
              style={[
                styles.tab,
                isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <Text style={styles.glyph}>{section.glyph}</Text>
              <Text
                variant="labelLarge"
                style={{ color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                {section.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  scroll: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  glyph: {
    fontSize: 16,
  },
});
