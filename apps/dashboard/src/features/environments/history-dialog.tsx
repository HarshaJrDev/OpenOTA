"use client";

import type { Platform } from "@openota/shared";
import { RotateCcw, Tag } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@openota/ui/dialog";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";

import { useEnvironmentHistory } from "./hooks";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "secondary" | "warning" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Superseded", variant: "secondary" },
  rolled_back: { label: "Rolled back", variant: "warning" },
};

export function HistoryDialog({
  open,
  onOpenChange,
  projectId,
  environmentName,
  channel,
  platform,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentName: string;
  channel: string;
  platform: Platform;
}) {
  const { data: history, isLoading } = useEnvironmentHistory(projectId, channel, platform, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {environmentName} · {platform === "android" ? "Android" : "iOS"} deployment history
          </DialogTitle>
          <DialogDescription>Every release and rollback that has touched this environment, newest first.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : !history || history.length === 0 ? (
          <EmptyState icon={Tag} title="No deployments yet" description="Release to this environment to see history here." />
        ) : (
          <ol className="relative max-h-96 space-y-5 overflow-y-auto border-l pl-5">
            {history.map((release) => {
              const badge = STATUS_BADGE[release.status] ?? STATUS_BADGE.inactive!;
              const isRollback = Boolean(release.rollback_reason);
              return (
                <li key={release.id} className="relative">
                  <span className="absolute -left-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-primary">
                    {isRollback && <RotateCcw className="h-2.5 w-2.5 text-primary-foreground" />}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">v{release.version}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    runtime {release.runtime_version} · {new Date(release.created_at).toLocaleString()}
                  </p>
                  {release.release_notes && <p className="mt-1.5 text-sm">{release.release_notes}</p>}
                  {release.rollback_reason && (
                    <p className="mt-1.5 text-sm text-amber-600 dark:text-amber-400">
                      Rollback reason: {release.rollback_reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
