"use client";

import * as React from "react";
import type { Platform } from "@openota/shared";
import { AlertTriangle, FolderKanban, RotateCcw, ScrollText, Tag, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Skeleton } from "@openota/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openota/ui/tooltip";

import { EmptyState } from "@/components/empty-state";
import { useEnvironments } from "@/features/environments/hooks";
import { useLogs } from "@/features/logs/hooks";
import type { DeploymentLogEntry, LogEventType } from "@/features/logs/api";
import { ApiError } from "@/lib/api-client";
import { useCurrentProject } from "@/features/projects/current-project-context";

const COLUMNS = ["Action", "Version", "Platform", "Channel", "By", "Reason", "When"];

const EVENT_META: Record<LogEventType, { label: string; icon: React.ElementType; tone: "default" | "secondary" | "destructive" }> = {
  release: { label: "Release", icon: Tag, tone: "default" },
  rollback: { label: "Rollback", icon: RotateCcw, tone: "destructive" },
  rollout_change: { label: "Rollout change", icon: TrendingUp, tone: "secondary" },
};

const ALL = "__all__";

export default function LogsPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — the activity log is scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectLogs projectId={currentProjectId} />;
}

function ProjectLogs({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = React.useState<Platform | typeof ALL>(ALL);
  const [channel, setChannel] = React.useState<string>(ALL);
  const [eventType, setEventType] = React.useState<LogEventType | typeof ALL>(ALL);

  const { data: environments } = useEnvironments(projectId);
  const {
    data: logs,
    isLoading,
    isError,
    error,
    refetch,
  } = useLogs(projectId, {
    platform: platform === ALL ? undefined : platform,
    channel: channel === ALL ? undefined : channel,
    eventType: eventType === ALL ? undefined : eventType,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-muted-foreground">
            Every release, rollback, and rollout change for this project — real events, not server request logs.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform | typeof ALL)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All platforms</SelectItem>
            <SelectItem value="android">Android</SelectItem>
            <SelectItem value="ios">iOS</SelectItem>
          </SelectContent>
        </Select>

        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All channels</SelectItem>
            {environments?.map((env) => (
              <SelectItem key={env.channel} value={env.channel}>
                {env.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventType} onValueChange={(v) => setEventType(v as LogEventType | typeof ALL)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            <SelectItem value="release">Release</SelectItem>
            <SelectItem value="rollback">Rollback</SelectItem>
            <SelectItem value="rollout_change">Rollout change</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the activity log"
          description={
            error instanceof ApiError
              ? error.message
              : "OpenOTA Server is currently unavailable. Check your connection and try again."
          }
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs || logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="p-0">
                    <EmptyState
                      icon={ScrollText}
                      title="No activity yet"
                      description="Releases, rollbacks, and rollout changes for this project will show up here as they happen."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: DeploymentLogEntry }) {
  const meta = EVENT_META[entry.event_type];
  const Icon = meta.icon;

  return (
    <TableRow>
      <TableCell>
        <Badge variant={meta.tone} className="gap-1">
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {entry.event_type === "rollout_change"
          ? `${entry.previous_rollout_percentage ?? 0}% → ${entry.rollout_percentage ?? 0}%`
          : `v${entry.version}`}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="capitalize">
          {entry.platform}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{entry.channel}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <ActorLabel entry={entry} />
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{entry.reason ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(entry.created_at).toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

function ActorLabel({ entry }: { entry: DeploymentLogEntry }) {
  if (entry.actor_type === "api_key") {
    const label = entry.actor_name ?? "Deleted API key";
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="underline decoration-dotted underline-offset-2">{label}</span>
          </TooltipTrigger>
          <TooltipContent>API key{entry.actor_name ? "" : " (since deleted — id no longer resolves to a name)"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (entry.actor_type === "system") return <span>System</span>;
  return <span>Dashboard</span>;
}
