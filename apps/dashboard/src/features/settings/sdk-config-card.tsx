"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";

import { useEnvironments } from "@/features/environments/hooks";
import { useCurrentProject } from "@/features/projects/current-project-context";
import { getEffectiveServerUrl } from "@/lib/api-client";

export function SdkConfigCard() {
  const { currentProjectId } = useCurrentProject();
  const { data: environments } = useEnvironments(currentProjectId);
  const [channel, setChannel] = React.useState("production");
  const [copied, setCopied] = React.useState(false);

  const snippet = React.useMemo(() => {
    const serverUrl = getEffectiveServerUrl();
    const lines = [`OTA.configure({`, `  serverUrl: "${serverUrl}",`];
    if (currentProjectId) lines.push(`  projectId: "${currentProjectId}",`);
    lines.push(`  channel: "${channel}",`, `  autoRestart: true,`, `});`);
    return lines.join("\n");
  }, [currentProjectId, channel]);

  function handleCopy() {
    void navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SDK Configuration</CardTitle>
        <CardDescription>Call this once at app startup, before checking for updates. Mirrors `OTA.configure()`.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentProjectId && (
          <p className="text-sm text-muted-foreground">Select a project above to fill in its projectId here.</p>
        )}

        {environments && environments.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Channel</span>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env.channel} value={env.channel}>
                    {env.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative">
          <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs">{snippet}</pre>
          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={handleCopy} title="Copy">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
