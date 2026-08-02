import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

import { CopyButton } from "@/components/copy-button";
import { getEffectiveServerUrl } from "@/lib/api-client";

interface QuickStartCardProps {
  projectId: string | null;
  apiKeyPlaceholder?: string;
}

function commands(projectId: string | null, apiKeyPlaceholder: string) {
  const serverUrl = getEffectiveServerUrl();
  return [
    { label: "Install the SDK", cmd: "npm install @openota/sdk @openota/native-android" },
    { label: "Install the CLI", cmd: "npm install -D @openota/cli" },
    { label: "Log in", cmd: `npx openota login --api-key ${apiKeyPlaceholder}` },
    {
      label: "Initialize config",
      cmd: projectId
        ? `npx openota init --server-url ${serverUrl} --project-id ${projectId}`
        : `npx openota init --server-url ${serverUrl}`,
    },
    { label: "Check your setup", cmd: "npx openota doctor" },
    { label: "Ship your first release", cmd: "npx openota release --version 1.0.1 --platform android" },
  ];
}

/** The "how do I actually go from this dashboard to a working app" card — every command a
 * first-time integrator needs, in the exact order they need it, each individually copyable. */
export function QuickStartCard({ projectId, apiKeyPlaceholder = "ota_live_..." }: QuickStartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick start</CardTitle>
        <CardDescription>Run these from your React Native app&apos;s project root, in order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {commands(projectId, apiKeyPlaceholder).map((step, i) => (
          <div key={step.cmd} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/50">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted-foreground">{step.label}</div>
              <code className="block truncate font-mono text-sm">{step.cmd}</code>
            </div>
            <CopyButton value={step.cmd} label={step.label} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
