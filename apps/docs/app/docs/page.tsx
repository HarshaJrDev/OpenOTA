import type { Metadata } from "next";
import { Cloud, KeyRound, Package, Server, Settings, Smartphone, Terminal } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Card } from "@openota/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

export const metadata: Metadata = {
  title: "Docs — OpenOTA",
  description: "How to install, configure, and run OpenOTA — self-hosted or Cloud.",
};

const NAV = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#self-hosted-vs-cloud", label: "Self-hosted vs. Cloud" },
  { href: "#cli", label: "CLI reference" },
  { href: "#sdk", label: "SDK config" },
  { href: "#dashboard", label: "Dashboard features" },
  { href: "#env", label: "Environment variables" },
];

const CLI_COMMANDS = [
  { cmd: "openota init", desc: "Writes openota.config.json — server URL, runtime version, platforms." },
  { cmd: "openota login --api-key <key>", desc: "Stores a Cloud API key in ~/.openota/credentials.json (0600), auto-resolves projectId." },
  { cmd: "openota doctor", desc: "Checks Node version, RN detection, native dirs, Metro, config, auth, server reachability, project access." },
  { cmd: "openota build", desc: "Bundles JS via Metro and computes the manifest (version, runtimeVersion, SHA-256)." },
  { cmd: "openota upload", desc: "Uploads an already-built package without changing the active version." },
  { cmd: "openota release --version <v> --platform <p>", desc: "build + upload + activate in one step — the command you run in CI." },
  { cmd: "openota rollback --platform <p> --version <v>", desc: "Points the active-version pointer at an already-uploaded release." },
  { cmd: "openota logout", desc: "Removes the stored API key for the configured server URL." },
];

const SDK_OPTIONS = [
  { key: "serverUrl", type: "string", required: true, desc: "Your OpenOTA server's API base, including /api/v1." },
  { key: "channel", type: "string", required: false, desc: 'Defaults to "production". Not yet enforced server-side in check — see Known gaps.' },
  { key: "autoRestart", type: "boolean", required: false, desc: "Reload the JS bundle automatically after install/rollback. Default true." },
  { key: "requestTimeout", type: "number", required: false, desc: "Milliseconds before a check/download request aborts. Default 15000." },
  { key: "headers", type: "Record<string,string>", required: false, desc: "Extra headers sent on every request." },
  { key: "projectId", type: "string", required: false, desc: "OpenOTA Cloud only — targets the project-scoped routes and enables device tracking + install-result reporting. Omit for self-hosted." },
];

const ENV_VARS = [
  { name: "DATABASE_URL", required: "no", desc: "Unset = embedded PGlite. postgres://... for managed Postgres (Supabase in Cloud)." },
  { name: "SESSION_SECRET", required: "yes in prod", desc: "Signs dashboard session cookies." },
  { name: "CORS_ALLOWED_ORIGINS", required: "yes for cross-site dashboard", desc: "Comma-separated allowlist for the dashboard's credentialed requests." },
  { name: "STORAGE_PROVIDER", required: "no", desc: '"local" or "supabase". Default local.' },
  { name: "RESEND_API_KEY", required: "no", desc: "Sends verification/reset emails. Unset = link is logged to the server console instead." },
  { name: "DASHBOARD_URL", required: "no", desc: "Base URL used to build verification/reset links." },
  { name: "OPENOTA_API_KEY", required: "no", desc: "Legacy single-tenant shared secret for self-hosted flat routes." },
];

function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Icon className="h-5 w-5 text-brand-from" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-16">
        <div>
          <Badge variant="secondary" className="mb-4">
            Documentation
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight">Using OpenOTA</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Everything you need to ship your first OTA update — CLI commands, SDK configuration,
            and what the Cloud dashboard actually does today (no fabricated features).
          </p>
        </div>

        <Section id="quickstart" icon={Terminal} title="Quickstart">
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
              <code>{`npm install @openota/sdk @openota/native-android
npm install -D @openota/cli

npx openota init --server-url https://YOUR-SERVER/api/v1 --runtime-version 1.0.0
npx openota doctor
npx openota release --version 1.0.1 --platform android`}</code>
            </pre>
          </Card>
          <p className="text-sm text-muted-foreground">
            Full native wiring (Android/iOS) and SDK integration walkthrough lives in{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="https://github.com/HarshaJrDev/OpenOTA/blob/main/docs/GETTING_STARTED.md"
            >
              docs/GETTING_STARTED.md
            </a>
            .
          </p>
        </Section>

        <Section id="self-hosted-vs-cloud" icon={Cloud} title="Self-hosted vs. Cloud">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">Self-hosted</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You run the server. One optional shared secret (<code>OPENOTA_API_KEY</code>), one flat
                storage namespace, CLI only — no dashboard concept needed.
              </p>
            </Card>
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">Cloud (multi-tenant)</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Per-user accounts, per-project API keys, isolated storage per project, full dashboard —
                projects, releases, rollback, devices, analytics.
              </p>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Both modes run from the exact same server binary and coexist — turning on Cloud never
            breaks the self-hosted flat routes. Full reference:{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="https://github.com/HarshaJrDev/OpenOTA/blob/main/docs/CLOUD.md"
            >
              docs/CLOUD.md
            </a>
            .
          </p>
        </Section>

        <Section id="cli" icon={Package} title="CLI reference">
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Command</TableHead>
                  <TableHead>What it does</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CLI_COMMANDS.map((row) => (
                  <TableRow key={row.cmd}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.cmd}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Section>

        <Section id="sdk" icon={Smartphone} title="SDK config (OTA.configure)">
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SDK_OPTIONS.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{row.type}</TableCell>
                    <TableCell>
                      {row.required ? <Badge variant="secondary">required</Badge> : <span className="text-xs text-muted-foreground">optional</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="text-sm text-muted-foreground">
            Setting <code>projectId</code>{" "}
            also makes the SDK send an anonymous, auto-generated
            device ID on every check/download, and report install/rollback outcomes automatically —
            that&apos;s what populates the dashboard&apos;s Devices and Analytics pages. Nothing extra to wire up.
          </p>
        </Section>

        <Section id="dashboard" icon={KeyRound} title="Dashboard features (Cloud)">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Auth", desc: "Signup, login, email verification, forgot/reset password." },
              { title: "Projects", desc: "Create, rename, delete. Each isolates its own releases, keys, and devices." },
              { title: "API keys", desc: "Full key shown once on creation, stored server-side only as a hash." },
              { title: "Releases", desc: "Per-project history with a real rollback button." },
              { title: "Devices", desc: "Real per-device last-seen registry, populated by the SDK automatically." },
              { title: "Analytics", desc: "Downloads, success rate, failures, rollbacks — all real, none fabricated." },
            ].map((f) => (
              <Card key={f.title} className="border-border/60 bg-card/60 p-5">
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="env" icon={Settings} title="Environment variables">
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variable</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ENV_VARS.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.required}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="text-sm text-muted-foreground">
            Full list including storage provider options:{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="https://github.com/HarshaJrDev/OpenOTA/blob/main/docs/CLOUD.md#5-environment-variables"
            >
              docs/CLOUD.md §5
            </a>
            .
          </p>
        </Section>

        <Card className="flex items-center gap-4 border-border/60 bg-card/60 p-6">
          <Server className="h-8 w-8 shrink-0 text-brand-from" />
          <div>
            <h3 className="font-medium">Self-hosting?</h3>
            <p className="text-sm text-muted-foreground">
              <code>docker compose up -d</code> gets a server running locally in under a minute — see the{" "}
              <a className="underline underline-offset-4 hover:text-foreground" href="https://github.com/HarshaJrDev/OpenOTA#readme">
                repo README
              </a>
              .
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
