"use client";

import type { Platform } from "@openota/shared";
import { Activity, Download, RotateCcw, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { StatCard } from "@/components/stat-card";
import { useInstallResultCounts } from "@/features/analytics/hooks";
import { useDevices } from "@/features/devices/hooks";
import { usePackages } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

export default function AnalyticsPage() {
  const { currentProjectId } = useCurrentProject();
  const { data: packages, isLoading } = usePackages(currentProjectId);
  const { data: devices, isLoading: devicesLoading } = useDevices(currentProjectId);
  const { data: installResults, isLoading: installResultsLoading } = useInstallResultCounts(currentProjectId);
  const totalDownloads = devices?.reduce((sum, device) => sum + device.download_count, 0) ?? 0;
  const totalInstalls = (installResults?.success ?? 0) + (installResults?.failure ?? 0);
  const successRate = totalInstalls > 0 ? Math.round(((installResults?.success ?? 0) / totalInstalls) * 100) : null;

  const byPlatform = ["android", "ios"].map((platform) => ({
    platform,
    packages: (packages ?? []).filter((pkg) => pkg.platform === (platform as Platform)).length,
  }));

  const byMonth = Object.entries(
    (packages ?? []).reduce<Record<string, number>>((acc, pkg) => {
      const month = new Date(pkg.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" });
      acc[month] = (acc[month] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([month, count]) => ({ month, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Downloads come from real device check-ins; installs/failures/rollbacks come from the
          SDK reporting its own outcome after each activation or rollback.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Downloads"
          icon={Download}
          value={totalDownloads.toString()}
          hint={`${devices?.length ?? 0} known device${devices?.length === 1 ? "" : "s"}`}
          loading={devicesLoading}
        />
        <StatCard
          title="Success Rate"
          icon={Activity}
          value={successRate === null ? "—" : `${successRate}%`}
          hint={successRate === null ? "No install results reported yet" : `${totalInstalls} install${totalInstalls === 1 ? "" : "s"} reported`}
          loading={installResultsLoading}
        />
        <StatCard
          title="Failures"
          icon={XCircle}
          value={String(installResults?.failure ?? 0)}
          loading={installResultsLoading}
        />
        <StatCard
          title="Rollbacks"
          icon={RotateCcw}
          value={String(installResults?.rollback ?? 0)}
          loading={installResultsLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Packages by Platform</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPlatform}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="platform" className="text-xs capitalize" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                  <Bar dataKey="packages" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Releases over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : byMonth.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No releases yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
