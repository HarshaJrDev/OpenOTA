"use client";

import type { PackageMetadata, Platform } from "@openota/shared";
import { Boxes, FolderKanban, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@openota/ui/button";
import { Input } from "@openota/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Skeleton } from "@openota/ui/skeleton";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { buildPackageColumns } from "@/features/packages/columns";
import { useDeletePackage, usePackages, useRollbackPackage } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

export default function PackagesPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — packages are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectPackages projectId={currentProjectId} />;
}

function ProjectPackages({ projectId }: { projectId: string }) {
  const { data: packages, isLoading } = usePackages(projectId);
  const deleteMutation = useDeletePackage(projectId);
  const rollbackMutation = useRollbackPackage(projectId);

  const [search, setSearch] = React.useState("");
  const [platformFilter, setPlatformFilter] = React.useState<Platform | "all">("all");
  const [pendingDelete, setPendingDelete] = React.useState<PackageMetadata | null>(null);
  const [pendingRollback, setPendingRollback] = React.useState<PackageMetadata | null>(null);

  const filtered = React.useMemo(
    () => (packages ?? []).filter((pkg) => platformFilter === "all" || pkg.platform === platformFilter),
    [packages, platformFilter],
  );

  const columns = React.useMemo(
    () => buildPackageColumns({ projectId, onDelete: setPendingDelete, onRollback: setPendingRollback }),
    [projectId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
        <p className="text-sm text-muted-foreground">Every OTA package uploaded to this server.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by version or SHA256…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as Platform | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="android">Android</SelectItem>
            <SelectItem value="ios">iOS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (packages ?? []).length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No packages uploaded yet"
          description="Run this from your React Native project root to publish your first package:"
          action={
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
              <code className="font-mono text-xs">npx openota release --version 1.0.0 --platform android</code>
              <CopyButton value="npx openota release --version 1.0.0 --platform android" label="release command" />
            </div>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          emptyMessage="No packages match your filters."
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.platform}@${pendingDelete?.bundleVersion}?`}
        description="This permanently removes the package from server storage. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate({ platform: pendingDelete.platform, version: pendingDelete.bundleVersion });
          setPendingDelete(null);
        }}
      />

      <ConfirmDialog
        open={pendingRollback !== null}
        onOpenChange={(open) => !open && setPendingRollback(null)}
        title={`Roll back ${pendingRollback?.platform} to v${pendingRollback?.bundleVersion}?`}
        description="Devices checking for updates will be offered this version instead of the current active release. No package is deleted."
        confirmLabel="Roll back"
        onConfirm={() => {
          if (pendingRollback) rollbackMutation.mutate({ platform: pendingRollback.platform, version: pendingRollback.bundleVersion });
          setPendingRollback(null);
        }}
      />
    </div>
  );
}
