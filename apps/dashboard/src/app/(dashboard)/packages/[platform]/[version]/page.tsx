"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Layers, Package, RotateCcw, Smartphone, Trash2 } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Separator } from "@openota/ui/separator";
import { Skeleton } from "@openota/ui/skeleton";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatCard } from "@/components/stat-card";
import { useReleaseStats } from "@/features/analytics/hooks";
import { getPackageDownloadUrl } from "@/features/packages/api";
import { useDeletePackage, usePackageDetail, useRollbackPackage } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-mono">{value}</span>
    </div>
  );
}

export default function ReleaseDetailsPage({
  params,
}: {
  params: Promise<{ platform: "android" | "ios"; version: string }>;
}) {
  const { platform, version } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProjectId } = useCurrentProject();
  // The Packages list links here with ?project=<id> so this page works even if it's opened
  // directly (e.g. a bookmarked/shared link) rather than only via in-app navigation.
  const projectId = searchParams.get("project") ?? currentProjectId ?? undefined;

  const { data: pkg, isLoading } = usePackageDetail(projectId, platform, version);
  const { data: stats, isLoading: statsLoading } = useReleaseStats(projectId, platform, version);
  const deleteMutation = useDeletePackage(projectId ?? "");
  const rollbackMutation = useRollbackPackage(projectId ?? "");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!pkg) {
    return <p className="text-sm text-muted-foreground">Package not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {pkg.platform}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">v{pkg.bundleVersion}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Uploaded {new Date(pkg.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={getPackageDownloadUrl(projectId!, pkg.platform, pkg.bundleVersion)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
          <Button variant="outline" onClick={() => setConfirmRollback(true)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Roll back to this
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Runtime Version" icon={Package} value={pkg.runtimeVersion} />
        <StatCard title="Manifest Version" icon={Package} value={String(pkg.manifestVersion)} />
        <StatCard
          title="Devices on this version"
          icon={Smartphone}
          value={String(stats?.devicesOnVersion ?? 0)}
          loading={statsLoading}
        />
        <StatCard
          title="Install Outcomes"
          icon={Layers}
          value={`${stats?.installCounts.success ?? 0} ok`}
          hint={
            stats
              ? `${stats.installCounts.failure} failed · ${stats.installCounts.rollback} rolled back`
              : undefined
          }
          loading={statsLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environments</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !stats || stats.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">This version has never been activated on any channel.</p>
          ) : (
            <ul className="divide-y">
              {stats.channels.map((channel) => (
                <li key={channel.channel} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium capitalize">{channel.channel}</span>
                    {channel.release_notes && <p className="truncate text-xs text-muted-foreground">{channel.release_notes}</p>}
                    {channel.rollback_reason && (
                      <p className="truncate text-xs text-muted-foreground">Rollback reason: {channel.rollback_reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {channel.status === "active" && channel.rollout_percentage < 100 && (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {channel.rollout_percentage}% rollout
                      </Badge>
                    )}
                    <Badge variant={channel.status === "active" ? "success" : channel.status === "rolled_back" ? "destructive" : "secondary"}>
                      {channel.status.replace("_", " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manifest</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <Row label="Bundle" value={pkg.bundleName} />
          <Row label="SHA256" value={pkg.sha256} />
          <Row label="Bundle Size" value={`${pkg.size.toLocaleString()} bytes`} />
          <Row label="Manifest Version" value={pkg.manifestVersion} />
          <Row label="Runtime Version" value={pkg.runtimeVersion} />
          <Row label="Created At" value={new Date(pkg.createdAt).toISOString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets ({pkg.assets?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {pkg.assets && pkg.assets.length > 0 ? (
            <ul className="space-y-1">
              {pkg.assets.map((asset) => (
                <li key={asset} className="font-mono text-xs text-muted-foreground">
                  {asset}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No assets recorded in this manifest.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${pkg.platform}@${pkg.bundleVersion}?`}
        description="This permanently removes the package from server storage. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteMutation.mutate({ platform: pkg.platform, version: pkg.bundleVersion });
          router.push("/packages");
        }}
      />

      <ConfirmDialog
        open={confirmRollback}
        onOpenChange={setConfirmRollback}
        title={`Roll back ${pkg.platform} to v${pkg.bundleVersion}?`}
        description="Devices checking for updates will be offered this version instead of the current active release."
        confirmLabel="Roll back"
        onConfirm={() => rollbackMutation.mutate({ platform: pkg.platform, version: pkg.bundleVersion })}
      />
    </div>
  );
}
