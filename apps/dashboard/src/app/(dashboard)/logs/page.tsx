"use client";

import { ScrollText } from "lucide-react";

import { EmptyState } from "@/components/empty-state";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Server-side request and event logs.</p>
      </div>

      <EmptyState
        icon={ScrollText}
        title="No log API yet"
        description="@openota/server logs to stdout via Pino, but doesn't expose a REST endpoint to read those logs back — and this dashboard only ever talks to the REST API, never the filesystem directly. Tail the server process (`pnpm --filter @openota/server start`) to see structured logs today."
      />
    </div>
  );
}
