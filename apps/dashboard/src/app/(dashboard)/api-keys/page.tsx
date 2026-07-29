"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@openota/ui/dialog";
import { Input } from "@openota/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import type { CreatedApiKey } from "@/features/api-keys/api";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/features/api-keys/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";

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
  const { data: keys, isLoading } = useApiKeys(projectId);
  const createKey = useCreateApiKey(projectId);
  const revokeKey = useRevokeApiKey(projectId);

  const [name, setName] = React.useState("");
  const [revokeTarget, setRevokeTarget] = React.useState<string | null>(null);
  const [justCreated, setJustCreated] = React.useState<CreatedApiKey | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    const created = await createKey.mutateAsync(name.trim());
    setName("");
    // Shown exactly once, here — never fetchable again, matches the server's own guarantee.
    setJustCreated(created);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">Generate, rotate, and scope credentials for CI and the CLI.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Key name (e.g. ci)" value={name} onChange={(event) => setName(event.target.value)} className="w-48" />
          <Button onClick={handleCreate} disabled={createKey.isPending || !name.trim()}>
            Generate key
          </Button>
        </div>
      </div>

      {!isLoading && keys?.length === 0 && (
        <EmptyState icon={KeyRound} title="No API keys yet" description="Generate one above to authenticate the CLI or CI." />
      )}

      {keys && keys.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
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
                <TableCell className="font-mono text-xs">{key.prefix}…</TableCell>
                <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}</TableCell>
                <TableCell>{key.revoked_at ? "Revoked" : "Active"}</TableCell>
                <TableCell>
                  {!key.revoked_at && (
                    <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(key.id)}>
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(justCreated)} onOpenChange={(open) => !open && setJustCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this now — it will never be shown again. If you lose it, revoke it and generate a new one.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md bg-muted p-3 text-sm">{justCreated?.fullKey}</code>
          <DialogFooter>
            <Button
              onClick={() => {
                if (justCreated) void navigator.clipboard.writeText(justCreated.fullKey);
              }}
            >
              Copy to clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this API key?"
        description="Any CLI or CI job using this key will immediately lose access. This cannot be undone."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (revokeTarget) void revokeKey.mutateAsync(revokeTarget);
          setRevokeTarget(null);
        }}
      />
    </div>
  );
}
