"use client";

import * as React from "react";
import type { Platform } from "@openota/shared";
import { FolderKanban, Layers, RotateCcw, ScrollText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
import type { Environment, EnvironmentRelease } from "@/features/environments/api";
import { HistoryDialog } from "@/features/environments/history-dialog";
import { useEnvironments } from "@/features/environments/hooks";
import { RollbackDialog } from "@/features/environments/rollback-dialog";
import { useCurrentProject } from "@/features/projects/current-project-context";

const DOT_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
};

const PLATFORMS: Platform[] = ["android", "ios"];
const PLATFORM_LABEL: Record<Platform, string> = { android: "Android", ios: "iOS" };

export default function EnvironmentsPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — environments are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectEnvironments projectId={currentProjectId} />;
}

function ProjectEnvironments({ projectId }: { projectId: string }) {
  const { data: environments, isLoading } = useEnvironments(projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
        <p className="text-sm text-muted-foreground">
          Production, Staging, and Development each have their own release, independent of the others.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : !environments || environments.length === 0 ? (
        <EmptyState icon={Layers} title="No environments yet" description="Environments are created automatically with every project." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {environments.map((env) => (
            <EnvironmentCard key={env.id} projectId={projectId} environment={env} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentCard({ projectId, environment }: { projectId: string; environment: Environment }) {
  const [rollbackPlatform, setRollbackPlatform] = React.useState<Platform | null>(null);
  const [historyPlatform, setHistoryPlatform] = React.useState<Platform | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[environment.color] ?? "bg-gray-400"}`} />
          {environment.name}
        </CardTitle>
        {environment.description && <p className="text-xs text-muted-foreground">{environment.description}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {PLATFORMS.map((platform) => {
          const active: EnvironmentRelease | null = environment.active[platform];
          return (
            <div key={platform} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {PLATFORM_LABEL[platform]}
                  </Badge>
                  {active ? (
                    <span className="truncate font-mono text-sm font-medium">v{active.version}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No release yet</span>
                  )}
                </div>
                {active && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {new Date(active.created_at).toLocaleDateString()}
                    {active.release_notes ? ` · ${active.release_notes}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {active && (
                  <Badge
                    variant="outline"
                    className="shrink-0 font-normal text-muted-foreground"
                    title="Staged rollout is not yet supported — every release ships to 100% of devices immediately."
                  >
                    100% rollout
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" title="History" onClick={() => setHistoryPlatform(platform)}>
                  <ScrollText className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Rollback"
                  disabled={!active}
                  onClick={() => setRollbackPlatform(platform)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      {rollbackPlatform && (
        <RollbackDialog
          open={Boolean(rollbackPlatform)}
          onOpenChange={(open) => !open && setRollbackPlatform(null)}
          projectId={projectId}
          environmentName={environment.name}
          channel={environment.channel}
          platform={rollbackPlatform}
          currentVersion={environment.active[rollbackPlatform]?.version ?? null}
        />
      )}

      {historyPlatform && (
        <HistoryDialog
          open={Boolean(historyPlatform)}
          onOpenChange={(open) => !open && setHistoryPlatform(null)}
          projectId={projectId}
          environmentName={environment.name}
          channel={environment.channel}
          platform={historyPlatform}
        />
      )}
    </Card>
  );
}
