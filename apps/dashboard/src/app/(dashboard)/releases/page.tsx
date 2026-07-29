"use client";

import type { PackageMetadata, Platform } from "@openota/shared";
import { FolderKanban, Tags } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
import { usePackages } from "@/features/packages/hooks";
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
            <Card key={platform}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base capitalize">
                  {platform}
                  <Badge variant="secondary">{groups[platform].length} releases</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groups[platform].length === 0 ? (
                  <p className="text-sm text-muted-foreground">No releases for {platform} yet.</p>
                ) : (
                  <ol className="relative space-y-4 border-l pl-4">
                    {groups[platform].map((release, index) => (
                      <li key={release.bundleVersion} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{release.bundleVersion}</span>
                          {index === 0 ? <Badge variant="success">latest uploaded</Badge> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          runtime {release.runtimeVersion} · {new Date(release.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
