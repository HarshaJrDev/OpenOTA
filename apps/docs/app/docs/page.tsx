import type { Metadata } from "next";
import { Boxes, Cloud, Database, HardDrive, KeyRound, Layers, Package, Server, Settings, Smartphone, Sparkles, Terminal } from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Card } from "@openota/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

export const metadata: Metadata = {
  title: "Docs — OpenOTA",
  description: "How to install, configure, and run OpenOTA — self-hosted or Cloud.",
};

const NAV = [
  { href: "#introduction", label: "Introduction" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#core-concepts", label: "Core concepts" },
  { href: "#requirements", label: "What you need" },
  { href: "#quickstart", label: "Quickstart" },
  { href: "#self-hosted-vs-cloud", label: "Self-hosted vs. Cloud" },
  { href: "#cli", label: "CLI reference" },
  { href: "#sdk", label: "SDK config" },
  { href: "#dashboard", label: "Dashboard features" },
  { href: "#env", label: "Environment variables" },
];

const CORE_CONCEPTS = [
  {
    icon: Package,
    title: "Release",
    desc: "One versioned JS bundle for one platform — built by openota build, checksummed, and uploaded. Immutable once uploaded.",
  },
  {
    icon: Layers,
    title: "Environment (Channel)",
    desc: 'Production / Staging / Development. Each has its own independent "active" release per platform — releasing to Staging never touches Production.',
  },
  {
    icon: Smartphone,
    title: "Runtime version",
    desc: "A compatibility fence, not a feature version. A device only accepts an OTA release whose runtimeVersion exactly matches its own native binary.",
  },
  {
    icon: Sparkles,
    title: "Rollback",
    desc: "Moves an environment's active pointer back to a previously-uploaded release. Instant, on-device, no re-download needed — nothing is ever deleted.",
  },
];

const REQUIREMENTS = [
  {
    icon: Server,
    title: "A server",
    required: "Required",
    desc: "Self-hosted (docker compose up) or OpenOTA Cloud — identical API either way, your app never knows the difference.",
  },
  {
    icon: Database,
    title: "Postgres",
    required: "Recommended",
    desc: "Unset falls back to an embedded file-based DB (PGlite) — fine for one instance/testing, not for anything you'd call production.",
  },
  {
    icon: HardDrive,
    title: "Storage backend",
    required: "Required",
    desc: "local disk (needs a persistent volume) or supabase (Supabase Storage). This is what actually holds your JS bundle bytes — kept deliberately separate from Postgres.",
  },
  {
    icon: Boxes,
    title: "Email sending",
    required: "Optional",
    desc: "Unset means verification/reset links are logged to the server console instead of emailed — fully functional without it.",
  },
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
  { key: "channel", type: "string", required: false, desc: 'Defaults to "production". Selects which environment\'s active release this device receives — each environment tracks its own independently.' },
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

        <section id="introduction" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Introduction</h2>
          <p className="text-muted-foreground">
            OpenOTA lets you ship JavaScript changes to a React Native app instantly — no app store
            review, no waiting days for a rollout. You build a bundle, push it to your own server (or
            OpenOTA Cloud), and every installed app checks in, downloads, verifies, and applies the
            update on its own. If something goes wrong, rollback is instant and happens entirely
            on-device.
          </p>
          <p className="text-muted-foreground">
            It&apos;s the same idea as CodePush or Expo Updates, with two differences that shape
            everything else in these docs: <strong className="text-foreground">you own the server</strong>{" "}
            (self-host it, or use the hosted Cloud — same code, your choice), and{" "}
            <strong className="text-foreground">the device never trusts the server blindly</strong> — the
            native runtime re-verifies every bundle&apos;s checksum itself before running it.
          </p>
        </section>

        <section id="how-it-works" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <Card className="overflow-hidden border-border/60 bg-card/60 p-6">
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground sm:text-sm">
{`Your RN app (SDK)   ──check/download──▶   OpenOTA Server
      ▲                                        │
      │ verify + apply                         ├──▶ Postgres  (metadata)
      │                                        └──▶ Storage   (bundle .zip)
 openota CLI  ─────────release────────────────▶`}
            </pre>
          </Card>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-foreground">
            <li>
              <strong className="text-foreground">You release.</strong> <code>openota release</code> bundles your JS
              (via Metro), computes a SHA-256 checksum, and uploads it to your server.
            </li>
            <li>
              <strong className="text-foreground">The server stores it two ways.</strong> Postgres holds only
              metadata (which version is &quot;active&quot; per environment); the actual bundle bytes go to your
              storage backend. Kept separate on purpose — see{" "}
              <a href="#requirements" className="underline underline-offset-4 hover:text-foreground">
                What you need
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">A device checks in.</strong> <code>OTA.check()</code> asks the
              server &quot;what&apos;s active for my platform + environment?&quot; and compares it to the
              device&apos;s current version.
            </li>
            <li>
              <strong className="text-foreground">It downloads and verifies independently.</strong> The native
              (Kotlin/Swift) runtime re-computes the checksum itself before ever running the new code — the
              server&apos;s word is never enough on its own.
            </li>
            <li>
              <strong className="text-foreground">Rollback is instant and local.</strong> The previous bundle stays
              on-device, so rolling back is a pointer swap, not a re-download.
            </li>
          </ol>
        </section>

        <section id="core-concepts" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Core concepts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CORE_CONCEPTS.map((c) => (
              <Card key={c.title} className="border-border/60 bg-card/60 p-5">
                <c.icon className="h-5 w-5 text-brand-from" />
                <h3 className="mt-3 font-medium">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{c.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="requirements" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">What you need</h2>
          <p className="text-muted-foreground">
            If you&apos;re using OpenOTA Cloud, all of this is already running — skip straight to{" "}
            <a href="#quickstart" className="underline underline-offset-4 hover:text-foreground">
              Quickstart
            </a>
            . If you&apos;re self-hosting, here&apos;s exactly what&apos;s required vs. optional.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {REQUIREMENTS.map((r) => (
              <Card key={r.title} className="border-border/60 bg-card/60 p-5">
                <div className="flex items-center gap-2">
                  <r.icon className="h-5 w-5 text-brand-from" />
                  <h3 className="font-medium">{r.title}</h3>
                  <Badge variant={r.required === "Required" ? "default" : r.required === "Recommended" ? "secondary" : "outline"} className="ml-auto text-xs">
                    {r.required}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            No Redis, no message queue, no separate auth provider — deliberately minimal.
          </p>
        </section>

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
              { title: "Environments", desc: "Production/Staging/Development per project, each with its own release, visual rollback, and deployment history." },
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
