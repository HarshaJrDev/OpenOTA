"use client";

import type { PackageMetadata, Platform } from "@openota/shared";
import { Boxes, Search } from "lucide-react";
import * as React from "react";

import { Input } from "@openota/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Skeleton } from "@openota/ui/skeleton";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { buildPackageColumns } from "@/features/packages/columns";
import { useDeletePackage, usePackages, useRollbackPackage } from "@/features/packages/hooks";

export default function PackagesPage() {
  const { data: packages, isLoading } = usePackages();
  const deleteMutation = useDeletePackage();
  const rollbackMutation = useRollbackPackage();

  const [search, setSearch] = React.useState("");
  const [platformFilter, setPlatformFilter] = React.useState<Platform | "all">("all");
  const [pendingDelete, setPendingDelete] = React.useState<PackageMetadata | null>(null);
  const [pendingRollback, setPendingRollback] = React.useState<PackageMetadata | null>(null);

  const filtered = React.useMemo(
    () => (packages ?? []).filter((pkg) => platformFilter === "all" || pkg.platform === platformFilter),
    [packages, platformFilter],
  );

  const columns = React.useMemo(
    () => buildPackageColumns({ onDelete: setPendingDelete, onRollback: setPendingRollback }),
    [],
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
          description="Run `openota release --version 1.0.0 --platform android` from your React Native project to publish your first package."
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
