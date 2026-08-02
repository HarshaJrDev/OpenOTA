"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, RefreshCw } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@openota/ui/dialog";
import { Input } from "@openota/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { CopyField } from "@/components/copy-field";
import { EmptyState } from "@/components/empty-state";
import { NextStepCard } from "@/components/next-step-card";
import { QuickStartCard } from "@/components/quick-start-card";
import type { ApiKey, CreatedApiKey } from "@/features/api-keys/api";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/features/api-keys/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { useProject } from "@/features/projects/hooks";
import { getEffectiveServerUrl } from "@/lib/api-client";

export default function ApiKeysPage() {
  const { currentProjectId } = useCurrentProject();

  if (!currentProjectId) {
    return (
      <EmptyState
        icon={KeyRound}
        title="No project selected"
        description="Choose or create a project first — API keys are scoped to a single project."
        action={
          <Button asChild>
            <Link href="/projects">Go to Projects</Link>
          </Button>
        }
      />
    );
  }

  return <ProjectApiKeys projectId={currentProjectId} />;
}

function ProjectApiKeys({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: keys, isLoading } = useApiKeys(projectId);
  const createKey = useCreateApiKey(projectId);
  const revokeKey = useRevokeApiKey(projectId);

  const [name, setName] = React.useState("");
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKey | null>(null);
  const [regenerateTarget, setRegenerateTarget] = React.useState<ApiKey | null>(null);
  const [justCreated, setJustCreated] = React.useState<CreatedApiKey | null>(null);

  const serverUrl = getEffectiveServerUrl();
  const activeKeys = keys?.filter((k) => !k.revoked_at) ?? [];

  async function handleCreate(keyName: string) {
    if (!keyName.trim()) return;
    const created = await createKey.mutateAsync(keyName.trim());
    setName("");
    // Shown exactly once, here — never fetchable again, matches the server's own guarantee.
    setJustCreated(created);
  }

  async function handleRegenerate(target: ApiKey) {
    const created = await createKey.mutateAsync(`${target.name} (regenerated)`);
    await revokeKey.mutateAsync(target.id);
    setRegenerateTarget(null);
    setJustCreated(created);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect</h1>
        <p className="text-sm text-muted-foreground">
          Everything your React Native app and CI pipeline need to talk to this project.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <CopyField
            label="Server URL"
            value={serverUrl}
            help="The base URL your app and the CLI send requests to. Goes into OTA.configure({ serverUrl }) and openota.config.json."
            description="Used by OTA.configure() and openota.config.json"
          />
          <CopyField
            label="Project ID"
            value={projectId}
            help="Identifies this project inside OpenOTA — scopes every release, device, and API key to it. Not a secret; safe to put in client code."
            description={project ? `For "${project.name}"` : undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">API Keys</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Used by the OpenOTA CLI to authenticate — e.g. <code className="font-mono">npx openota login --api-key ...</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Key name (e.g. ci)" value={name} onChange={(event) => setName(event.target.value)} className="w-48" />
            <Button onClick={() => void handleCreate(name)} disabled={createKey.isPending || !name.trim()}>
              Generate key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!isLoading && keys?.length === 0 && (
            <EmptyState icon={KeyRound} title="No API keys yet" description="Generate one above to authenticate the CLI or CI." />
          )}

          {keys && keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {key.prefix}
                      {"•".repeat(20)}
                    </TableCell>
                    <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}</TableCell>
                    <TableCell>{key.revoked_at ? "Revoked" : "Active"}</TableCell>
                    <TableCell>
                      {!key.revoked_at && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setRegenerateTarget(key)} className="gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" />
                            Regenerate
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(key)}>
                            Revoke
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Full keys are never shown again after creation — only the prefix is kept, so this list can&apos;t leak a
            working key even if someone sees your screen.
          </p>
        </CardContent>
      </Card>

      <QuickStartCard projectId={projectId} apiKeyPlaceholder={activeKeys[0] ? `${activeKeys[0].prefix}...` : "ota_live_..."} />

      {activeKeys.length > 0 && (
        <NextStepCard
          accomplished="You have a working API key."
          next="Configure your app's package name, bundle identifier, and runtime version."
          actionLabel="Go to Apps"
          href="/apps"
        />
      )}

      <Dialog open={Boolean(justCreated)} onOpenChange={(open) => !open && setJustCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this now — it will never be shown again. If you lose it, regenerate it from the table.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <code className="block flex-1 break-all text-sm">{justCreated?.fullKey}</code>
            {justCreated && <CopyButton value={justCreated.fullKey} label="API key" />}
          </div>
          {justCreated && (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3">
              <code className="block flex-1 break-all font-mono text-xs text-muted-foreground">
                npx openota login --api-key {justCreated.fullKey}
              </code>
              <CopyButton value={`npx openota login --api-key ${justCreated.fullKey}`} label="command" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke "${revokeTarget?.name}"?`}
        description="Any CLI or CI job using this key will immediately lose access. This cannot be undone."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revokeTarget) void revokeKey.mutateAsync(revokeTarget.id);
          setRevokeTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(regenerateTarget)}
        onOpenChange={(open) => !open && setRegenerateTarget(null)}
        title={`Regenerate "${regenerateTarget?.name}"?`}
        description="Creates a new key and immediately revokes this one. Any CLI or CI job still using the old key will lose access as soon as this completes — update them with the new key first if that matters to you."
        confirmLabel="Regenerate"
        destructive
        onConfirm={() => {
          if (regenerateTarget) void handleRegenerate(regenerateTarget);
        }}
      />
    </div>
  );
}
