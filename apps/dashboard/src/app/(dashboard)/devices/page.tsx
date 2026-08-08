"use client";

import * as React from "react";
import { FolderKanban, Search, Smartphone, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Input } from "@openota/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Skeleton } from "@openota/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { EmptyState } from "@/components/empty-state";
import type { DeviceCheckin } from "@/features/devices/api";
import { useDevices } from "@/features/devices/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

const COLUMNS = ["Device", "Version", "Runtime", "Platform", "Downloads", "Last Seen"];
const ALL = "__all__";

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

  const [search, setSearch] = React.useState("");
  const [platform, setPlatform] = React.useState(ALL);
  const [runtimeVersion, setRuntimeVersion] = React.useState(ALL);
  const [appVersion, setAppVersion] = React.useState(ALL);

  // Filter options are derived from the real, currently-loaded device list — not a fixed/guessed
  // set — so a filter never offers a value that would return zero results. There's no server-side
  // filtering endpoint for devices, and the full list is already fetched client-side either way
  // (no pagination on this endpoint), so filtering here is the efficient choice, not a shortcut.
  const platforms = React.useMemo(() => uniqueSorted(devices, (d) => d.platform), [devices]);
  const runtimeVersions = React.useMemo(() => uniqueSorted(devices, (d) => d.runtime_version), [devices]);
  const appVersions = React.useMemo(() => uniqueSorted(devices, (d) => d.app_version), [devices]);

  const filtered = React.useMemo(() => {
    if (!devices) return devices;
    const query = search.trim().toLowerCase();
    return devices.filter((device) => {
      if (platform !== ALL && device.platform !== platform) return false;
      if (runtimeVersion !== ALL && device.runtime_version !== runtimeVersion) return false;
      if (appVersion !== ALL && device.app_version !== appVersion) return false;
      if (query && !device.device_id.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [devices, platform, runtimeVersion, appVersion, search]);

  const hasActiveFilters = platform !== ALL || runtimeVersion !== ALL || appVersion !== ALL || search.trim() !== "";

  function clearFilters() {
    setSearch("");
    setPlatform(ALL);
    setRuntimeVersion(ALL);
    setAppVersion(ALL);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">Devices that have checked in for updates.</p>
        </div>
        {devices && devices.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {filtered?.length ?? 0} of {devices.length} device{devices.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {devices && devices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search device ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 pl-8"
            />
          </div>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={runtimeVersion} onValueChange={setRuntimeVersion}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Runtime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All runtimes</SelectItem>
              {runtimeVersions.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={appVersion} onValueChange={setAppVersion}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="App version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All app versions</SelectItem>
              {appVersions.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

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
              ) : filtered && filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="p-0">
                    <EmptyState
                      icon={Search}
                      title="No devices match these filters"
                      description="Try clearing a filter or broadening your search."
                      action={
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((device) => (
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

function uniqueSorted(devices: DeviceCheckin[] | undefined, pick: (d: DeviceCheckin) => string): string[] {
  if (!devices) return [];
  return [...new Set(devices.map(pick))].sort();
}
