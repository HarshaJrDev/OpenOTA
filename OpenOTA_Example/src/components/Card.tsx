import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";

import { colors } from "../theme/colors";
import { radius, shadow, spacing } from "../theme/spacing";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
});
