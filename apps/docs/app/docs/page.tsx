import type { Metadata } from "next";
import {
  AlertTriangle,
  Boxes,
  Cloud,
  Database,
  FlaskConical,
  HardDrive,
  KeyRound,
  Layers,
  Package,
  Server,
  Settings,
  Smartphone,
  Sparkles,
  Terminal,
  Wifi,
} from "lucide-react";

import { Badge } from "@openota/ui/badge";
import { Card } from "@openota/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { CodeBlock } from "../components/code-block";

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
  { href: "#native-deps", label: "Native dependencies" },
  { href: "#remote-config", label: "Remote config" },
  { href: "#realtime", label: "Real-time updates" },
  { href: "#dashboard", label: "Dashboard features" },
  { href: "#env", label: "Environment variables" },
  { href: "#reference-app", label: "Reference app" },
  { href: "#troubleshooting", label: "Troubleshooting" },
  { href: "#self-hosting", label: "Self-hosting & cloud setup" },
];

const TROUBLESHOOTING = [
  {
    q: "\"Bundle checksum mismatch\" or \"Bundle entry not found in the uploaded zip\" on release",
    a: "The uploaded zip's JS bundle doesn't match the claimed sha256/path — the server independently re-verifies both rather than trusting the CLI's claim. If you're calling the upload API directly instead of using the CLI, the bundle file must be at bundle/<bundleName> inside the zip, matching what the SDK's extractor expects on-device.",
  },
  {
    q: "\"Manifest not found\" when the app tries to activate an update",
    a: "The native runtime independently re-verifies the downloaded package — it re-parses manifest.json from the extracted files on disk, not the JS object the check() call returned. A package missing manifest.json (a hand-built or corrupted zip) fails here even if the server accepted the upload, by design: the JS layer is never treated as a trust boundary.",
  },
  {
    q: "\"Bundle runtimeVersion does not match app runtimeVersion\"",
    a: "The release's runtimeVersion doesn't match the value passed to OpenOTAReactHost.create() in MainApplication.kt. This is intentional — an OTA bundle built against a different native binary generation should never activate. Fix the mismatch, don't work around it: keep openota.config.json's runtimeVersion and the native constant in sync deliberately.",
  },
  {
    q: "A device stays on \"Embedded\" after reinstalling the app or clearing app data",
    a: "Expected, not a bug. The OTA-installed bundle lives in the app's private storage (Android: /data/data/<package>/files/OpenOTA/...) — both a full reinstall and Settings → Clear Data wipe that storage the same way Android wipes any app's private data. Check for update once more and it re-downloads cleanly.",
  },
  {
    q: "\"Rollback failed\" / \"No rollback bundle is available\"",
    a: "Correct behavior on a device that has only ever had one OTA generation installed (or none) — there's genuinely nothing to roll back to yet. The native runtime only ever keeps one previous generation; install a second real update first if you want to test rollback.",
  },
  {
    q: "\"An unexpected error occurred\" (500) on upload instead of a specific error",
    a: "If this happens on a self-hosted server with a genuinely malformed (non-zip) upload, you're hitting a real fixed bug from an earlier OpenOTA version — update to the latest server. A correctly-updated server always translates a corrupted upload into a clean 400 UPLOAD_FAILED, never a bare 500.",
  },
  {
    q: "npx openota: 404 Not Found from the npm registry",
    a: 'There is no package literally named "openota" on npm. The published package is @openota/cli — run npx @openota/cli <command>, or install it as a dev dependency and use your package manager\'s bin resolution (npm run / pnpm exec).',
  },
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

const NATIVE_DEPS = [
  { pkg: "react-native-mmkv", why: "Fast on-device key/value cache for the current version, bundle path, manifest, and anonymous device ID." },
  { pkg: "react-native-nitro-modules", why: "Required by the Nitro-based versions of mmkv and quick-crypto. A peer dependency of both, but never auto-installed — see below." },
  { pkg: "react-native-fs", why: "Filesystem access for downloading and staging the update bundle." },
  { pkg: "react-native-zip-archive", why: "Extracts the downloaded .zip bundle before it's verified and installed." },
  { pkg: "react-native-quick-crypto", why: "Computes the SHA-256 checksum used to verify every bundle before it runs." },
  { pkg: "react-native-quick-base64", why: "A peer dependency of quick-crypto itself — easy to miss since npm hoists it without you ever installing it directly." },
];

const ENV_VARS = [
  { name: "DATABASE_URL", required: "no", desc: "Unset = embedded PGlite. postgres://... for managed Postgres (Supabase in Cloud)." },
  { name: "SESSION_SECRET", required: "yes in prod", desc: "Signs dashboard session cookies." },
  { name: "CORS_ALLOWED_ORIGINS", required: "yes for cross-site dashboard", desc: "Comma-separated allowlist for the dashboard's credentialed requests." },
  { name: "STORAGE_PROVIDER", required: "no", desc: '"local" or "supabase". Default local.' },
  { name: "RESEND_API_KEY", required: "no", desc: "Sends verification/reset emails. Unset = link is logged to the server console instead." },
  { name: "DASHBOARD_URL", required: "no", desc: "Base URL used to build verification/reset and Google sign-in redirect links." },
  { name: "OPENOTA_API_KEY", required: "no", desc: "Legacy single-tenant shared secret for self-hosted flat routes." },
  { name: "GOOGLE_CLIENT_ID / _SECRET / _REDIRECT_URI", required: "no, all three or none", desc: 'Enables "Continue with Google" on the dashboard login page.' },
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
            <CodeBlock
              label="architecture diagram"
              preClassName="text-xs leading-relaxed text-muted-foreground sm:text-sm p-0 pr-8"
              code={`Your RN app (SDK)   ──check/download──▶   OpenOTA Server
      ▲                                        │
      │ verify + apply                         ├──▶ Postgres  (metadata)
      │                                        └──▶ Storage   (bundle .zip)
 openota CLI  ─────────release────────────────▶`}
            />
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
            <CodeBlock
              label="quickstart commands"
              code={`npm install -D @openota/cli

npx openota init --server-url https://YOUR-SERVER/api/v1 --runtime-version 1.0.0
npx openota doctor
npx openota release --version 1.0.1 --platform android`}
            />
          </Card>
          <p className="text-sm text-muted-foreground">
            <code>openota init</code> detects your package manager (npm, yarn, or pnpm) and automatically installs{" "}
            <code>@openota/sdk</code>, <code>@openota/native-android</code>, and every native peer dependency the SDK
            needs — nothing to install by hand. Pass <code>--skip-install</code> to opt out. If a dependency ever
            goes missing later, <code>npx openota doctor --fix</code> repairs it the same way.
          </p>
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

        <Section id="native-deps" icon={Boxes} title="Native dependencies">
          <p className="text-muted-foreground">
            <code>@openota/sdk</code> is a thin JS layer over a few native modules. <code>openota init</code> installs
            these automatically (see Quickstart above) — but every one of them still needs a real native rebuild
            before the SDK will work, not just a JS reload.
          </p>
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Package</TableHead>
                  <TableHead>What it&apos;s for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NATIVE_DEPS.map((row) => (
                  <TableRow key={row.pkg}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.pkg}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.why}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <CodeBlock
              label="native dependency commands"
              code={`# Already installed for you by \`openota init\` — only needed if you're adding these manually
npm install react-native-mmkv react-native-nitro-modules \\
  react-native-fs react-native-zip-archive \\
  react-native-quick-crypto react-native-quick-base64

# iOS — required after installing or upgrading any of the above
cd ios && bundle exec pod install && cd ..

# Android — autolinking picks these up automatically, but only on a full rebuild
cd android && ./gradlew clean && cd ..

npx react-native run-ios   # or run-android`}
            />
          </Card>
          <p className="text-sm text-muted-foreground">
            Forgetting the native rebuild is the single most common integration mistake — it surfaces as a vague JS
            error like <code>Cannot read property &apos;otaStorage&apos; of undefined</code> the moment{" "}
            <code>OTA.configure()</code> or <code>OTA.sync()</code> runs, since the native module the SDK depends on
            was never linked into the app binary. <code>npx openota doctor</code> checks for this.
          </p>
        </Section>

        <Section id="remote-config" icon={Boxes} title="Remote config (optional)">
          <p className="text-muted-foreground">
            Separate from OTA bundles entirely — a per-(project, platform) JSON value your app can fetch at runtime
            and react to however you like. Editable from the dashboard&apos;s Apps page, no new release required to
            change it.
          </p>
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <CodeBlock
              label="remote config API"
              code={`GET  /projects/:projectId/apps/:platform/config   # public, no auth — same as check/download
PUT  /projects/:projectId/apps/:platform          # session-authed, dashboard/API only
     body: { "remoteConfig": { "anyKey": "anyValue" } }`}
            />
          </Card>
          <p className="text-sm text-muted-foreground">
            OpenOTA never reads or acts on the value itself — what it means is entirely up to your app. Two things
            worth knowing: the endpoint sends <code>Cache-Control: no-store</code>, and this is a plain{" "}
            <code>fetch()</code> that does <em>not</em> inherit <code>OTA.configure()</code>&apos;s{" "}
            <code>requestTimeout</code> — add your own <code>AbortController</code> timeout, or a slow/cold server
            can hang the request far longer than expected.
          </p>
        </Section>

        <Section id="realtime" icon={Wifi} title="Real-time updates (optional)">
          <p className="text-muted-foreground">
            By default a device only learns about a release the next time your app calls{" "}
            <code>OTA.sync()</code> — OpenOTA never polls on its own. To have the server nudge an
            already-open app instantly instead of waiting for the next launch or resume, open a
            live connection once:
          </p>
          <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
            <CodeBlock
              label="real-time updates example"
              code={`OTA.connectLive(); // e.g. right after OTA.configure()
// ...
OTA.disconnectLive(); // e.g. on unmount

// or react to it yourself instead of the default silent OTA.sync():
OTA.connectLive(() => {
  console.log('a release just went out — re-checking now');
  OTA.sync();
});`}
            />
          </Card>
          <p className="text-sm text-muted-foreground">
            Pure JS — React Native&apos;s built-in <code>WebSocket</code>, no native setup, no extra
            dependency. The server pushes a content-free &quot;check now&quot; nudge whenever a
            release, rollback, or rollout-percentage change happens on that device&apos;s channel;
            the real <code>check</code> endpoint (with its staged-rollout gate) stays the single
            source of truth for what a device is actually eligible for — nothing is pushed except
            the nudge itself. Reconnects automatically with backoff. Only reaches the app while
            it&apos;s open or backgrounded-but-alive — a fully closed app isn&apos;t woken up (that
            would need push notifications, which OpenOTA doesn&apos;t do yet).
          </p>
        </Section>

        <Section id="dashboard" icon={KeyRound} title="Dashboard features (Cloud)">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Auth", desc: "Email/password or Google sign-in, email verification, forgot/reset password. Google links onto an existing account by matching email rather than duplicating it." },
              { title: "Projects", desc: "Create, rename, delete. Each isolates its own releases, keys, and devices." },
              { title: "API keys", desc: "Full key shown once on creation, stored server-side only as a hash." },
              {
                title: "Environments",
                desc: "Production/Staging/Development per project, each with its own release, visual rollback, and deployment history. Rolling back only changes what an environment offers — a device already ahead of the rollback target won't downgrade (the check endpoint never silently downgrades a device); it applies to devices still behind it, same as any other update.",
              },
              { title: "Apps", desc: "Package name, bundle identifier, runtime version, min supported version, and remote config — per (project, platform)." },
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

        <Section id="reference-app" icon={FlaskConical} title="Reference app">
          <p className="text-muted-foreground">
            <code>OpenOTA_Example</code> in the monorepo is a real, working OTA client — not a mock. Every
            screen talks to the live OpenOTA Cloud API through the real, published <code>@openota/sdk</code> and{" "}
            <code>@openota/native-android</code> packages: check for update, download, verify, install, and
            rollback, all real. It deliberately does not reimplement release/channel management — that stays on
            this dashboard, exactly the separation of concerns your own app should follow.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">What to read</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                <li>
                  <code>src/context/OtaContext.tsx</code> — the entire integration surface: one{" "}
                  <code>OTA.configure()</code> call, check/sync/rollback wired to React state.
                </li>
                <li>
                  <code>android/app/.../MainApplication.kt</code> — the required{" "}
                  <code>OpenOTAReactHost.create()</code> native wiring, with the runtime-version constant.
                </li>
                <li>
                  <code>openota.config.json</code> — a real <code>serverUrl</code>/<code>projectId</code>/
                  <code>runtimeVersion</code> pointed at a live project, not a placeholder.
                </li>
              </ul>
            </Card>
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">Try it yourself</h3>
              <CodeBlock
                label="reference app quickstart"
                code={`cd OpenOTA_Example
npm install
npm run android
npx @openota/cli release --version 1.0.1`}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Reopen the app and pull-to-refresh — the update comes from the real server response, not a
                fixture.
              </p>
            </Card>
          </div>
          <div>
            <h3 className="mb-2 font-medium">The whole integration, verbatim</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              This is the actual <code>OTA.configure()</code> call from <code>src/context/OtaContext.tsx</code> —
              copied straight out of the reference app, not rewritten for docs.
            </p>
            <CodeBlock
              label="OpenOTA_Example/src/context/OtaContext.tsx"
              code={`import { OTA } from "@openota/sdk";
import config from "../../openota.config.json";

// One-time, module-level configure() — real values from openota.config.json, pointed at the live
// OpenOTA Cloud server. Everything this app shows/does from here on is driven by what that server
// returns; release/channel management itself happens on the OpenOTA Dashboard, not in this app.
OTA.configure({
  serverUrl: config.serverUrl,
  projectId: config.projectId,
  channel: "production",
  autoRestart: false, // let the UI show a clear "Update ready — restart" state first
});

// Live updates: the server nudges this connection the instant a new release/rollback/rollout
// change happens on this device's channel, instead of waiting for a manual check.
OTA.connectLive(() => setUpdateAvailable(true));`}
            />
          </div>
        </Section>

        <Section id="troubleshooting" icon={AlertTriangle} title="Troubleshooting">
          <p className="text-muted-foreground">
            Real errors this project has actually surfaced, not a generic FAQ — each one either explains
            intentional behavior or names a bug that&apos;s already fixed in the current release.
          </p>
          <div className="space-y-4">
            {TROUBLESHOOTING.map((item) => (
              <Card key={item.q} className="border-border/60 bg-card/60 p-5">
                <h3 className="font-medium">{item.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="self-hosting" icon={Server} title="Self-hosting &amp; cloud setup">
          <p className="text-muted-foreground">
            One server codebase, three ways to run it — a deployment/ownership choice, never a different
            product.
          </p>

          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mode</TableHead>
                  <TableHead>Server</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">OpenOTA Cloud</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>OpenOTA</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Managed + Your Data</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>OpenOTA</TableCell>
                  <TableCell>You</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Full Self-Hosted</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>You</TableCell>
                  <TableCell>You</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">OpenOTA Cloud</strong> — zero setup: create an account,
                create a project, get a <code>projectId</code> + API key.
              </li>
              <li>
                <strong className="text-foreground">Managed + Your Data</strong> — OpenOTA runs a dedicated
                server instance for you, but your data plane is yours: your own Postgres, your own storage
                bucket, your own email credentials — your releases never sit in shared infrastructure.
              </li>
              <li>
                <strong className="text-foreground">Full Self-Hosted</strong> — <code>docker compose up -d</code>{" "}
                on your own infrastructure. You own every layer.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-medium">Full Self-Hosted: what you need to provide</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Every row except the first has a working zero-config default, so you only touch what you
              actually want to own.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>You need</TableHead>
                  <TableHead>Default (zero setup)</TableHead>
                  <TableHead>Or bring your own</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">A server</TableCell>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Required — any machine that runs Docker (a VPS, your own hardware). No specific cloud provider.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Database</TableCell>
                  <TableCell className="text-muted-foreground">Embedded, on the same server</TableCell>
                  <TableCell className="text-muted-foreground">
                    <code>DATABASE_URL</code> → any real Postgres (Supabase or otherwise)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">File storage</TableCell>
                  <TableCell className="text-muted-foreground">Local disk, on the same server</TableCell>
                  <TableCell className="text-muted-foreground">
                    <code>STORAGE_PROVIDER=supabase</code> → your Supabase Storage project + bucket
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Domain</TableCell>
                  <TableCell className="text-muted-foreground">Your server&apos;s raw IP</TableCell>
                  <TableCell className="text-muted-foreground">A subdomain you own, DNS pointed at that server</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Email</TableCell>
                  <TableCell className="text-muted-foreground">Links logged to the server console</TableCell>
                  <TableCell className="text-muted-foreground">
                    A Resend API key, or SMTP creds for any mailbox
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Once running, the real, live status of each of these — which provider is active, is it actually
              reachable right now — is visible in the dashboard under <strong>Admin → Infrastructure</strong>{" "}
              (masked config only; credentials never round-trip to the browser).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">Self-hosted (Docker)</h3>
              <CodeBlock
                label="docker-compose.yml — real content from the repo root"
                code={`services:
  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - "\${PORT:-3900}:\${PORT:-3900}"
    env_file: [.env]
    volumes:
      - openota_storage:/data/storage
      - openota_pgdata:/repo/apps/server/data/pgdata

volumes:
  openota_storage:
  openota_pgdata:`}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                <code>docker compose up -d</code> — no <code>.env</code> file needed to start: local storage and
                an embedded PGlite database are the defaults, so this works with zero external accounts.
              </p>
            </Card>
            <Card className="border-border/60 bg-card/60 p-5">
              <h3 className="font-medium">Cloud (Render + Vercel)</h3>
              <ul className="mt-1 list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Server → Render.</strong> Set <code>DATABASE_URL</code> to a
                  real Postgres connection string (Supabase works) so accounts/projects survive restarts, and{" "}
                  <code>CORS_ALLOWED_ORIGINS</code> to your dashboard&apos;s origin.
                </li>
                <li>
                  <strong className="text-foreground">Dashboard → Vercel.</strong> Set{" "}
                  <code>NEXT_PUBLIC_OPENOTA_SERVER_URL</code> to your Render URL, including{" "}
                  <code>/api/v1</code>.
                </li>
                <li>
                  <strong className="text-foreground">Never deploy the server to Vercel</strong> — serverless has
                  no persistent filesystem for local package storage, even with a managed database.
                </li>
                <li>
                  Optional: <code>RESEND_API_KEY</code> or <code>SMTP_HOST</code>/<code>SMTP_USER</code>/
                  <code>SMTP_PASS</code> for real verification/reset emails (unset = link logged to the server
                  console, fully functional with zero email infra); <code>ADMIN_EMAILS</code> to grant admin
                  access to specific accounts.
                </li>
              </ul>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Full environment variable reference, architecture, and API docs:{" "}
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="https://github.com/HarshaJrDev/OpenOTA/blob/main/docs/CLOUD.md"
            >
              docs/CLOUD.md
            </a>{" "}
            in the repo.
          </p>
        </Section>
      </div>
    </div>
  );
}
