"use client";

import * as React from "react";
import type { Platform } from "@openota/shared";
import { CheckCircle2, FolderKanban, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";
import { Skeleton } from "@openota/ui/skeleton";
import { Textarea } from "@openota/ui/textarea";

import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { InfoTooltip } from "@/components/info-tooltip";
import { NextStepCard } from "@/components/next-step-card";
import type { AppConfig } from "@/features/apps/api";
import { useAppConfigs, useUpsertAppConfig } from "@/features/apps/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

const PLATFORMS: Platform[] = ["android", "ios"];
const PLATFORM_LABEL: Record<Platform, string> = { android: "Android", ios: "iOS" };

export default function AppsPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — app settings are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectApps projectId={currentProjectId} />;
}

function ProjectApps({ projectId }: { projectId: string }) {
  const { data: configs, isLoading } = useAppConfigs(projectId);
  const configByPlatform = React.useMemo(() => {
    const map = new Map<Platform, AppConfig>();
    for (const config of configs ?? []) map.set(config.platform, config);
    return map;
  }, [configs]);

  const anyConfigured = (configs?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <p className="text-sm text-muted-foreground">
          Package identifiers and version metadata for each platform — display info for the dashboard, not enforced by
          the OTA pipeline.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {PLATFORMS.map((platform) => (
            <AppConfigCard key={platform} projectId={projectId} platform={platform} config={configByPlatform.get(platform) ?? null} />
          ))}
        </div>
      )}

      {anyConfigured && (
        <NextStepCard
          accomplished="You've configured at least one platform."
          next="Ship your first OTA release from the CLI."
          actionLabel="See release commands"
          href="/api-keys"
        />
      )}
    </div>
  );
}

function AppConfigCard({ projectId, platform, config }: { projectId: string; platform: Platform; config: AppConfig | null }) {
  const upsert = useUpsertAppConfig(projectId);
  const [runtimeVersion, setRuntimeVersion] = React.useState(config?.runtime_version ?? "");
  const [packageName, setPackageName] = React.useState(config?.package_name ?? "");
  const [bundleIdentifier, setBundleIdentifier] = React.useState(config?.bundle_identifier ?? "");
  const [minSupportedVersion, setMinSupportedVersion] = React.useState(config?.min_supported_version ?? "");
  const [remoteConfigText, setRemoteConfigText] = React.useState(config?.remote_config ?? "");
  const [remoteConfigError, setRemoteConfigError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRuntimeVersion(config?.runtime_version ?? "");
    setPackageName(config?.package_name ?? "");
    setBundleIdentifier(config?.bundle_identifier ?? "");
    setMinSupportedVersion(config?.min_supported_version ?? "");
    setRemoteConfigText(config?.remote_config ?? "");
    setRemoteConfigError(null);
  }, [config]);

  const identifierLabel = platform === "android" ? "Package name" : "Bundle identifier";
  const identifierHelp =
    platform === "android"
      ? "Your app's applicationId, e.g. com.yourcompany.yourapp — found in android/app/build.gradle."
      : "Your app's Bundle Identifier, e.g. com.yourcompany.yourapp — found in Xcode under General → Identity, or ios/<App>.xcodeproj.";
  const identifierValue = platform === "android" ? packageName : bundleIdentifier;
  const setIdentifierValue = platform === "android" ? setPackageName : setBundleIdentifier;

  function handleSave() {
    // `null` = "clear this field," `undefined` = "leave whatever's stored alone" — this form
    // always resends every field, so an empty input unambiguously means "clear it," not "I didn't
    // mean to touch this." Previously this sent `undefined` for an emptied field, which the
    // server read as "not touching it" and silently kept the old value — indistinguishable from a
    // save that appeared to revert your change back to stale data.
    let remoteConfig: Record<string, unknown> | null = null;
    if (remoteConfigText.trim()) {
      try {
        const parsed: unknown = JSON.parse(remoteConfigText);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setRemoteConfigError("Must be a JSON object, e.g. {\"uiVersion\": \"2.0.0\"}");
          return;
        }
        remoteConfig = parsed as Record<string, unknown>;
      } catch {
        setRemoteConfigError("Not valid JSON");
        return;
      }
    }
    setRemoteConfigError(null);

    upsert.mutate({
      platform,
      fields: {
        runtimeVersion: runtimeVersion || undefined,
        packageName: platform === "android" ? packageName || null : undefined,
        bundleIdentifier: platform === "ios" ? bundleIdentifier || null : undefined,
        minSupportedVersion: minSupportedVersion || null,
        remoteConfig,
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          {PLATFORM_LABEL[platform]}
          {config ? (
            <Badge variant="outline" className="ml-auto gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Configured
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto text-xs">
              Not configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`${platform}-identifier`}>{identifierLabel}</Label>
            <InfoTooltip>{identifierHelp}</InfoTooltip>
          </div>
          <div className="flex gap-1.5">
            <Input
              id={`${platform}-identifier`}
              placeholder="com.example.app"
              value={identifierValue}
              onChange={(e) => setIdentifierValue(e.target.value)}
            />
            {identifierValue && <CopyButton value={identifierValue} label={identifierLabel} />}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`${platform}-runtime`}>Runtime version</Label>
            <InfoTooltip>
              A compatibility fence, not a feature version. This must match the runtimeVersion your native app was
              built with — a device only receives releases whose runtimeVersion matches its own exactly.
            </InfoTooltip>
          </div>
          <div className="flex gap-1.5">
            <Input
              id={`${platform}-runtime`}
              placeholder="1.0.0"
              value={runtimeVersion}
              onChange={(e) => setRuntimeVersion(e.target.value)}
            />
            {runtimeVersion && <CopyButton value={runtimeVersion} label="Runtime version" />}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`${platform}-min-version`}>Min supported version</Label>
            <InfoTooltip>
              Optional. Display-only floor for the oldest app version you still want counted as supported — not
              enforced by the OTA pipeline itself.
            </InfoTooltip>
          </div>
          <Input
            id={`${platform}-min-version`}
            placeholder="1.0.0"
            value={minSupportedVersion}
            onChange={(e) => setMinSupportedVersion(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`${platform}-remote-config`}>Remote config</Label>
              <InfoTooltip>
                Arbitrary JSON your app can fetch at runtime (GET .../apps/{platform}/config, no auth needed) —
                independent of which OTA bundle is active. Change it here and the app sees the new value on its next
                poll, with no new release required. OpenOTA doesn&apos;t read or act on this itself; it&apos;s
                entirely up to your app what to do with it.
              </InfoTooltip>
            </div>
            {remoteConfigText && (
              <button
                type="button"
                onClick={() => {
                  setRemoteConfigText("");
                  setRemoteConfigError(null);
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <Textarea
            id={`${platform}-remote-config`}
            placeholder={'{"uiVersion": "2.0.0"}'}
            value={remoteConfigText}
            onChange={(e) => {
              setRemoteConfigText(e.target.value);
              setRemoteConfigError(null);
            }}
            rows={3}
            className="font-mono text-xs"
          />
          {remoteConfigError ? (
            <p className="text-xs text-destructive">{remoteConfigError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {remoteConfigText.trim() ? "Saving will replace the stored config with this." : "Empty — saving will clear any stored config for this platform."}
            </p>
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
