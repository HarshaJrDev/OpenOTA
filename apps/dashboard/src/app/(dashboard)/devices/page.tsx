"use client";

import { FolderKanban, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Skeleton } from "@openota/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { EmptyState } from "@/components/empty-state";
import { useDevices } from "@/features/devices/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

const COLUMNS = ["Device", "Version", "Runtime", "Platform", "Downloads", "Last Seen"];

export default function DevicesPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — devices are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectDevices projectId={currentProjectId} />;
}

function ProjectDevices({ projectId }: { projectId: string }) {
  const { data: devices, isLoading } = useDevices(projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">Devices that have checked in for updates.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
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
              {!devices || devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="p-0">
                    <EmptyState
                      icon={Smartphone}
                      title="No devices yet"
                      description="Devices show up here after their first check for an update against this project."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-mono text-xs">{device.device_id.slice(0, 12)}…</TableCell>
                    <TableCell>{device.app_version}</TableCell>
                    <TableCell>{device.runtime_version}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {device.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>{device.download_count}</TableCell>
                    <TableCell>{new Date(device.last_seen_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
