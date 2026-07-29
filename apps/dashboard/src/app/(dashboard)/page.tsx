"use client";

import Link from "next/link";
import { Activity, Download, RotateCcw, Smartphone, Tag } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { usePackages } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

export default function OverviewPage() {
  const { currentProjectId } = useCurrentProject();
  const { data: packages, isLoading } = usePackages(currentProjectId);

  const sorted = [...(packages ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">A snapshot of your OpenOTA deployment.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Latest Release"
          icon={Tag}
          loading={isLoading}
          value={latest ? `v${latest.bundleVersion}` : "—"}
          hint={latest ? `${latest.platform} · ${new Date(latest.createdAt).toLocaleDateString()}` : "No packages uploaded yet"}
        />
        <StatCard title="Downloads" icon={Download} unavailable unavailableReason="Requires device check-in tracking" />
        <StatCard title="Success Rate" icon={Activity} unavailable unavailableReason="Requires install-result reporting" />
        <StatCard title="Rollback Rate" icon={RotateCcw} unavailable unavailableReason="Requires install-result reporting" />
        <StatCard title="Devices Online" icon={Smartphone} unavailable unavailableReason="Requires a device registry" />
        <StatCard
          title="Total Packages"
          icon={Tag}
          loading={isLoading}
          value={String(packages?.length ?? 0)}
          hint="Across all platforms"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No packages yet"
              description="Run `openota release` from your React Native project to publish your first package."
            />
          ) : (
            <ul className="divide-y">
              {sorted.slice(0, 8).map((pkg) => (
                <li key={`${pkg.platform}-${pkg.bundleVersion}`} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="capitalize">
                      {pkg.platform}
                    </Badge>
                    <Link
                      href={`/packages/${pkg.platform}/${pkg.bundleVersion}?project=${currentProjectId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      v{pkg.bundleVersion}
                    </Link>
                    <span className="text-xs text-muted-foreground">runtime {pkg.runtimeVersion}</span>
                  </div>
                  <time className="text-xs text-muted-foreground">{new Date(pkg.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
