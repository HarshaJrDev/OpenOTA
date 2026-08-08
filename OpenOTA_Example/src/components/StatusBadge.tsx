import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/spacing";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
  info: { bg: colors.infoMuted, fg: colors.info },
  neutral: { bg: colors.neutralMuted, fg: colors.neutral },
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...typography.small, textTransform: "uppercase", letterSpacing: 0.3 },
});
