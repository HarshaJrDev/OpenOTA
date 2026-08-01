"use client";

import * as React from "react";
import type { Platform } from "@openota/shared";
import { FolderKanban, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
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
    </div>
  );
}

function AppConfigCard({ projectId, platform, config }: { projectId: string; platform: Platform; config: AppConfig | null }) {
  const upsert = useUpsertAppConfig(projectId);
  const [runtimeVersion, setRuntimeVersion] = React.useState(config?.runtime_version ?? "");
  const [packageName, setPackageName] = React.useState(config?.package_name ?? "");
  const [bundleIdentifier, setBundleIdentifier] = React.useState(config?.bundle_identifier ?? "");
  const [minSupportedVersion, setMinSupportedVersion] = React.useState(config?.min_supported_version ?? "");

  React.useEffect(() => {
    setRuntimeVersion(config?.runtime_version ?? "");
    setPackageName(config?.package_name ?? "");
    setBundleIdentifier(config?.bundle_identifier ?? "");
    setMinSupportedVersion(config?.min_supported_version ?? "");
  }, [config]);

  const identifierLabel = platform === "android" ? "Package name" : "Bundle identifier";
  const identifierValue = platform === "android" ? packageName : bundleIdentifier;
  const setIdentifierValue = platform === "android" ? setPackageName : setBundleIdentifier;

  function handleSave() {
    upsert.mutate({
      platform,
      fields: {
        runtimeVersion: runtimeVersion || undefined,
        packageName: platform === "android" ? packageName || undefined : undefined,
        bundleIdentifier: platform === "ios" ? bundleIdentifier || undefined : undefined,
        minSupportedVersion: minSupportedVersion || undefined,
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          {PLATFORM_LABEL[platform]}
          {!config && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Not configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${platform}-identifier`}>{identifierLabel}</Label>
          <Input
            id={`${platform}-identifier`}
            placeholder={platform === "android" ? "com.example.app" : "com.example.app"}
            value={identifierValue}
            onChange={(e) => setIdentifierValue(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${platform}-runtime`}>Runtime version</Label>
          <Input
            id={`${platform}-runtime`}
            placeholder="1.0.0"
            value={runtimeVersion}
            onChange={(e) => setRuntimeVersion(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${platform}-min-version`}>Min supported version</Label>
          <Input
            id={`${platform}-min-version`}
            placeholder="1.0.0"
            value={minSupportedVersion}
            onChange={(e) => setMinSupportedVersion(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
