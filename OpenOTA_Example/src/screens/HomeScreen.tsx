import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Logo } from "../components/Logo";
import { StatusBadge } from "../components/StatusBadge";
import { useOta } from "../context/OtaContext";
import { colors } from "../theme/colors";
import { radius, spacing, typography } from "../theme/spacing";

const STAGE_LABEL: Record<string, string> = {
  idle: "Idle",
  checking: "Checking for updates…",
  downloading: "Downloading…",
  extracting: "Extracting…",
  verifying: "Verifying…",
  installing: "Installing…",
  done: "Done",
  error: "Failed",
};

/**
 * The ONE screen. Everything above the "Update" card — the title, tagline, and accent color — is
 * ordinary app content, which means it's also exactly what changes when a new OTA bundle is
 * published from the dashboard: ship a release with a different <AppHeader>, and this device
 * shows the new name/color/layout the moment it updates. That's the whole demo. Release, channel,
 * and rollout management all happen on the OpenOTA Dashboard — this screen only ever displays
 * what the server already decided.
 */
function AppHeader() {
  return (
    <View style={styles.header}>
      <Logo size={56} />
      <Text style={styles.appName}>⚡ OpenOTA Example v3</Text>
      <Text style={styles.appTagline}>Second real OTA release — proves rollback has a real previous generation to restore.</Text>
    </View>
  );
}

export function HomeScreen() {
  const ota = useOta();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const busy = ["checking", "downloading", "extracting", "verifying", "installing"].includes(ota.phase);

  const onRefresh = async () => {
    setRefreshing(true);
    await ota.checkNow();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader />

      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Version</Text>
          <Text style={styles.detailValue}>{ota.currentVersion?.version ?? "Embedded"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Channel</Text>
          <Text style={styles.detailValue}>{ota.channel}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          {ota.updateAvailable ? <StatusBadge label="Update available" tone="info" /> : <StatusBadge label="Up to date" tone="success" />}
        </View>
      </Card>

      <Card>
        {busy ? (
          <View style={styles.progressBlock}>
            <Text style={styles.stageLabel}>{STAGE_LABEL[ota.phase] ?? ota.phase}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${ota.progressPercent ?? (ota.phase === "checking" ? 15 : 55)}%` }]} />
            </View>
          </View>
        ) : null}

        {ota.lastError ? <Text style={styles.error}>{ota.lastError}</Text> : null}

        <View style={styles.actions}>
          <Button label="Check for update" onPress={ota.checkNow} loading={ota.phase === "checking"} variant="secondary" style={styles.actionBtn} />
          <Button
            label={ota.updateAvailable ? "Download & install" : "Sync"}
            onPress={ota.syncNow}
            loading={busy && ota.phase !== "checking"}
            style={styles.actionBtn}
          />
        </View>

        {ota.lastResult?.status === "restart-required" && !busy ? (
          <Button label="Restart to apply update" onPress={ota.restartNow} variant="secondary" style={{ marginTop: spacing.sm }} />
        ) : null}

        <Button label="Rollback to previous version" onPress={ota.rollbackNow} variant="ghost" loading={ota.phase === "installing"} style={{ marginTop: spacing.sm }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  header: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  appName: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.sm, textAlign: "center" },
  appTagline: { ...typography.caption, color: colors.textSecondary, textAlign: "center", maxWidth: 260 },
  detailsCard: { gap: 2 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  detailLabel: { ...typography.body, color: colors.textSecondary },
  detailValue: { ...typography.bodyStrong, color: colors.textPrimary },
  progressBlock: { marginBottom: spacing.md },
  stageLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.brand },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1 },
});
