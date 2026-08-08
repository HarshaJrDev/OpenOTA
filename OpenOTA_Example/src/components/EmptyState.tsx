import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing, typography } from "../theme/spacing";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = "📦", title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  icon: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: "center" },
  description: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  action: { marginTop: spacing.lg },
});
