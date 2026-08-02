"use client";

import * as React from "react";
import type { Platform } from "@openota/shared";
import { ArrowDown } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@openota/ui/dialog";
import { Label } from "@openota/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Textarea } from "@openota/ui/textarea";

import { useRollbackPackage } from "@/features/packages/hooks";

import type { EnvironmentRelease } from "./api";
import { useEnvironmentHistory } from "./hooks";

export function RollbackDialog({
  open,
  onOpenChange,
  projectId,
  environmentName,
  channel,
  platform,
  currentVersion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentName: string;
  channel: string;
  platform: Platform;
  currentVersion: string | null;
}) {
  const { data: history } = useEnvironmentHistory(projectId, channel, platform, open);
  const rollback = useRollbackPackage(projectId);
  const [targetVersion, setTargetVersion] = React.useState<string>("");
  const [reason, setReason] = React.useState("");

  // Anything except the currently-active version is a valid rollback target — including a version
  // that's already `rolled_back`, since rollback is just "move the pointer," never destructive.
  const candidates = (history ?? []).filter((r) => r.version !== currentVersion);

  React.useEffect(() => {
    if (open) {
      setTargetVersion("");
      setReason("");
    }
  }, [open]);

  async function handleConfirm() {
    if (!targetVersion) return;
    await rollback.mutateAsync({ platform, version: targetVersion, channel, reason: reason.trim() || undefined });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roll back {environmentName}</DialogTitle>
          <DialogDescription>
            Changes what this environment serves to <em>new</em> checks — devices whose installed version is already
            newer than the target won&apos;t downgrade (the check endpoint never silently downgrades a device, by
            design). Devices behind the target pick it up on their next check as normal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 py-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="font-mono text-lg font-semibold">{currentVersion ?? "—"}</p>
          </div>
          <ArrowDown className="h-5 w-5 text-muted-foreground" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Roll back to</p>
            <p className="font-mono text-lg font-semibold text-destructive">{targetVersion || "—"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Target version</Label>
            <Select value={targetVersion} onValueChange={setTargetVersion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a version to roll back to" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No other releases in this environment yet
                  </SelectItem>
                ) : (
                  candidates.map((release: EnvironmentRelease) => (
                    <SelectItem key={release.id} value={release.version}>
                      v{release.version} · {new Date(release.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="e.g. v2.0.0 caused crashes on Android 12"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!targetVersion || rollback.isPending} onClick={handleConfirm}>
            {rollback.isPending ? "Rolling back…" : "Roll back"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
