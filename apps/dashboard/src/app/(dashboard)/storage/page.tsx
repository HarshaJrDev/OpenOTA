"use client";

import Link from "next/link";
import { Boxes, CheckCircle2, Cloud, Database, HardDrive, Package, XCircle } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { CopyField } from "@/components/copy-field";
import { EmptyState } from "@/components/empty-state";
import { InfoTooltip } from "@/components/info-tooltip";
import { StatCard } from "@/components/stat-card";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { useStorageInfo } from "@/features/storage/hooks";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

export default function StoragePage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={Database}
        title="No project selected"
        description="Choose or create a project first — storage usage is scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectStorage projectId={currentProjectId} />;
}

function ProjectStorage({ projectId }: { projectId: string }) {
  const { data: storage, isLoading } = useStorageInfo(projectId);

  const providerLabel = storage?.provider === "supabase" ? "Supabase Storage" : "Local disk";
  const ProviderIcon = storage?.provider === "supabase" ? Cloud : HardDrive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">
          Where release bundles for this project physically live, and how much space they use.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Packages stored"
          icon={Package}
          value={String(storage?.packageCount ?? 0)}
          hint="Distinct platform + version bundles"
          loading={isLoading}
        />
        <StatCard
          title="Storage used"
          icon={Boxes}
          value={storage ? formatBytes(storage.bytesUsed) : undefined}
          hint="Sum of every distinct bundle's real size"
          loading={isLoading}
        />
        <StatCard
          title="Backend status"
          icon={storage?.healthy ? CheckCircle2 : XCircle}
          value={isLoading ? undefined : storage?.healthy ? "Healthy" : "Unreachable"}
          accent={storage?.healthy ? "success" : "destructive"}
          hint={storage?.healthy ? "Reachable with the configured credentials" : "Check server logs / credentials"}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ProviderIcon className="h-4 w-4 text-muted-foreground" />
            {isLoading ? "Provider" : providerLabel}
          </CardTitle>
          {!isLoading && (
            <Badge variant={storage?.healthy ? "success" : "destructive"}>
              {storage?.healthy ? "Connected" : "Connection failed"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="divide-y">
          {isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : (
            <>
              <CopyField
                label="Provider"
                value={providerLabel}
                mono={false}
                help="Which storage backend this OpenOTA server is configured to use — set server-wide via STORAGE_PROVIDER, not per project."
              />
              {storage?.provider === "supabase" && storage.bucket && (
                <CopyField
                  label="Bucket"
                  value={storage.bucket}
                  copyLabel="Bucket name"
                  help="The Supabase Storage bucket every project's release bundles are written into, isolated per project by key prefix."
                />
              )}
              {storage?.provider === "local" && storage.storageRoot && (
                <CopyField
                  label="Storage root"
                  value={storage.storageRoot}
                  copyLabel="Storage root path"
                  help="The directory on the server's own disk where bundles are written — set via STORAGE_ROOT. Not durable across redeploys on most PaaS unless it's a mounted volume."
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            Changing providers
            <InfoTooltip>
              Storage provider is a server-wide setting (STORAGE_PROVIDER + credentials in your server&apos;s
              environment) — it can&apos;t be changed per project from the dashboard, since every project on this
              server shares one backend.
            </InfoTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Self-hosting and want to switch from local disk to Supabase (or back)? Set{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">STORAGE_PROVIDER=supabase</code> plus{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_URL</code> /{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in your server&apos;s
          environment and redeploy — existing bundles under the old provider aren&apos;t migrated automatically.
        </CardContent>
      </Card>
    </div>
  );
}
