"use client";

import type { Platform } from "@openota/shared";
import { GitBranch } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";

import { EmptyState } from "@/components/empty-state";
import { usePackages } from "@/features/packages/hooks";

export default function ChannelsPage() {
  const { data: packages, isLoading } = usePackages();

  const platforms = Array.from(new Set((packages ?? []).map((pkg) => pkg.platform))) as Platform[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        <p className="text-sm text-muted-foreground">
          The active-version pointer the server maintains per platform — see below for what's real today.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Named release channels aren&apos;t implemented server-side yet</CardTitle>
          <CardDescription>
            The CLI and SDK both accept a <code className="font-mono">channel</code> config value, but{" "}
            <code className="font-mono">@openota/server</code> doesn&apos;t use it in <code className="font-mono">check</code> — every
            device on a platform is offered the same active version regardless of channel. What IS real is a per-platform
            active-version pointer (see the Rollback action on Packages), shown below.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : platforms.length === 0 ? (
        <EmptyState icon={GitBranch} title="No platforms yet" description="Upload a package for a platform to see it here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => (
            <Card key={platform}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base capitalize">
                  {platform}
                  <Badge variant="secondary">1 pointer</Badge>
                </CardTitle>
                <CardDescription>
                  Every device on {platform} is currently offered whatever version is active for this platform.
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
