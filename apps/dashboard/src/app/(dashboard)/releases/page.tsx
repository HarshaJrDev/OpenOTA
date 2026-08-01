"use client";

import type { PackageMetadata, Platform } from "@openota/shared";
import { FolderKanban, Tags } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { useCheckForUpdate, usePackages, useRollbackPackage } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

function groupByPlatform(packages: PackageMetadata[]): Record<Platform, PackageMetadata[]> {
  const groups: Record<Platform, PackageMetadata[]> = { android: [], ios: [] };
  for (const pkg of packages) {
    groups[pkg.platform].push(pkg);
  }
  for (const platform of Object.keys(groups) as Platform[]) {
    groups[platform].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return groups;
}

export default function ReleasesPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — releases are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectReleases projectId={currentProjectId} />;
}

function ProjectReleases({ projectId }: { projectId: string }) {
  const { data: packages, isLoading } = usePackages(projectId);
  const groups = groupByPlatform(packages ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Releases</h1>
        <p className="text-sm text-muted-foreground">Release history per platform, newest first.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (packages ?? []).length === 0 ? (
        <EmptyState icon={Tags} title="No releases yet" description="Publish a package with the OpenOTA CLI to see it here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(groups) as Platform[]).map((platform) => (
            <PlatformReleases key={platform} projectId={projectId} platform={platform} releases={groups[platform]} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformReleases({
  projectId,
  platform,
  releases,
}: {
  projectId: string;
  platform: Platform;
  releases: PackageMetadata[];
}) {
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  // "0.0.0" is always older than every real version, so the server's active-pointer fallback
  // (max semver if unset) or its actual active pointer always wins — this is the only existing
  // endpoint that exposes "what version is active", so we reuse it as a lookup rather than adding
  // a new one just for a badge.
  const { data: active } = useCheckForUpdate(projectId, platform, "0.0.0", releases.length > 0);
  const activeVersion = active?.latestVersion ?? releases[0]?.bundleVersion ?? null;
  const rollback = useRollbackPackage(projectId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base capitalize">
          {platform}
          <Badge variant="secondary">{releases.length} releases</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No releases for {platform} yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {releases.map((release) => {
              const isActive = release.bundleVersion === activeVersion;
              return (
                <li key={release.bundleVersion} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/packages/${platform}/${release.bundleVersion}?project=${projectId}`}
                      className="font-medium hover:underline"
                    >
                      v{release.bundleVersion}
                    </Link>
                    {isActive ? (
                      <Badge variant="success">active</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={rollback.isPending}
                        onClick={() => setRollbackTarget(release.bundleVersion)}
                      >
                        Roll back to this
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    runtime {release.runtimeVersion} · {new Date(release.createdAt).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <ConfirmDialog
        open={Boolean(rollbackTarget)}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        title={`Roll back ${platform} to v${rollbackTarget}?`}
        description="Devices on this platform will receive this version as the latest update on their next check. This does not delete any release."
        confirmLabel="Roll back"
        destructive
        onConfirm={() => {
          if (rollbackTarget) void rollback.mutateAsync({ platform, version: rollbackTarget });
          setRollbackTarget(null);
        }}
      />
    </Card>
  );
}
