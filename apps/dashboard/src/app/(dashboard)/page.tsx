"use client";

import Link from "next/link";
import { Activity, ArrowRight, Boxes, CheckCircle2, Circle, Download, FolderKanban, KeyRound, Layers, RotateCcw, Smartphone, Tag } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { useInstallResultCounts } from "@/features/analytics/hooks";
import { useApiKeys } from "@/features/api-keys/hooks";
import { useAppConfigs } from "@/features/apps/hooks";
import { useDevices } from "@/features/devices/hooks";
import { useEnvironments } from "@/features/environments/hooks";
import { usePackages } from "@/features/packages/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { useProject } from "@/features/projects/hooks";

export default function OverviewPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Choose or create a project first — everything on this dashboard is scoped to one project at a time."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectOverview projectId={currentProjectId} />;
}

function ProjectOverview({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: packages, isLoading } = usePackages(projectId);
  const { data: devices, isLoading: devicesLoading } = useDevices(projectId);
  const { data: installResults, isLoading: installResultsLoading } = useInstallResultCounts(projectId);
  const { data: appConfigs } = useAppConfigs(projectId);
  const { data: environments } = useEnvironments(projectId);
  const { data: apiKeys } = useApiKeys(projectId);

  const totalDownloads = devices?.reduce((sum, device) => sum + device.download_count, 0) ?? 0;
  const totalInstalls = (installResults?.success ?? 0) + (installResults?.failure ?? 0);
  const successRate = totalInstalls > 0 ? Math.round(((installResults?.success ?? 0) / totalInstalls) * 100) : null;
  const totalRollbackable = totalInstalls + (installResults?.rollback ?? 0);
  const rollbackRate =
    totalRollbackable > 0 ? Math.round(((installResults?.rollback ?? 0) / totalRollbackable) * 100) : null;

  const sorted = [...(packages ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];

  const androidConfigured = appConfigs?.some((c) => c.platform === "android") ?? false;
  const iosConfigured = appConfigs?.some((c) => c.platform === "ios") ?? false;
  const activeKeys = apiKeys?.filter((k) => !k.revoked_at).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{project?.name ?? "Overview"}</h1>
            {project && (
              <span className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">{project.id}</span>
                <CopyButton value={project.id} label="Project ID" />
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Everything about this project, in one place.</p>
        </div>
      </div>

      {/* "See everything" strip — every other section of this project, one click away, with its
          current status visible right here instead of making you click in to find out. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewLinkCard
          href="/apps"
          icon={Smartphone}
          title="Apps"
          status={
            androidConfigured && iosConfigured
              ? "Android + iOS configured"
              : androidConfigured || iosConfigured
                ? "1 of 2 platforms configured"
                : "Not configured yet"
          }
          done={androidConfigured || iosConfigured}
        />
        <OverviewLinkCard
          href="/api-keys"
          icon={KeyRound}
          title="Connect"
          status={activeKeys > 0 ? `${activeKeys} active API key${activeKeys === 1 ? "" : "s"}` : "No API key yet"}
          done={activeKeys > 0}
        />
        <OverviewLinkCard
          href="/environments"
          icon={Layers}
          title="Environments"
          status={environments && environments.length > 0 ? `${environments.length} configured` : "Using defaults"}
          done={Boolean(environments && environments.length > 0)}
        />
        <OverviewLinkCard
          href="/releases"
          icon={Boxes}
          title="Releases"
          status={packages && packages.length > 0 ? `${packages.length} published` : "No releases yet"}
          done={Boolean(packages && packages.length > 0)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Latest Release"
          icon={Tag}
          loading={isLoading}
          value={latest ? `v${latest.bundleVersion}` : "—"}
          hint={latest ? `${latest.platform} · ${new Date(latest.createdAt).toLocaleDateString()}` : "No packages uploaded yet"}
        />
        <StatCard title="Downloads" icon={Download} value={totalDownloads.toString()} loading={devicesLoading} />
        <StatCard
          title="Success Rate"
          icon={Activity}
          value={successRate === null ? "—" : `${successRate}%`}
          hint={successRate === null ? "No install results yet" : undefined}
          loading={installResultsLoading}
        />
        <StatCard
          title="Rollback Rate"
          icon={RotateCcw}
          value={rollbackRate === null ? "—" : `${rollbackRate}%`}
          hint={rollbackRate === null ? "No install results yet" : undefined}
          loading={installResultsLoading}
        />
        <StatCard
          title="Known Devices"
          icon={Smartphone}
          value={String(devices?.length ?? 0)}
          loading={devicesLoading}
        />
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
                      href={`/packages/${pkg.platform}/${pkg.bundleVersion}?project=${projectId}`}
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

function OverviewLinkCard({
  href,
  icon: Icon,
  title,
  status,
  done,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  status: string;
  done: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Icon className="h-4 w-4 text-secondary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{title}</span>
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">{status}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        </CardContent>
      </Card>
    </Link>
  );
}
