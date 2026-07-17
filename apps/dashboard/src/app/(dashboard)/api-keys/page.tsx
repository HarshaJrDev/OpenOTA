"use client";

import { KeyRound } from "lucide-react";

import { Button } from "@openota/ui/button";

import { EmptyState } from "@/components/empty-state";

export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">Generate, rotate, and scope credentials for CI and the CLI.</p>
        </div>
        <Button disabled>Generate key</Button>
      </div>

      <EmptyState
        icon={KeyRound}
        title="Authentication isn't implemented yet"
        description="@openota/server currently has no auth layer — every endpoint is unauthenticated. Generate/Rotate/Delete/Scopes are wired up in this UI but disabled until the server ships API keys, so this page never pretends to manage credentials that don't exist."
      />
    </div>
  );
}
