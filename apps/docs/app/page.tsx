import {
  ArrowRight,
  Check,
  Cloud,
  Layers,
  Lock,
  LogIn,
  Package,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { CopyButton } from "./components/copy-button";
import { FadeIn } from "./components/fade-in";
import { SiteFooter, SiteNav } from "./components/site-nav";

const STACK = ["React Native", "TypeScript", "Kotlin", "Swift", "PostgreSQL", "Express"];

const ENVIRONMENTS_PREVIEW = [
  { name: "Production", version: "1.4.2", status: "active", rollout: 100, devices: "12,204" },
  { name: "Staging", version: "1.5.0-rc.2", status: "active", rollout: 40, devices: "318" },
  { name: "Development", version: "1.5.0-dev.9", status: "active", rollout: 100, devices: "6" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant OTA updates",
    description: "Ship JS bundle changes to every device in seconds — no app store review, no waiting.",
  },
  {
    icon: RotateCcw,
    title: "Native rollback",
    description: "Rolling back happens entirely on-device, no server round-trip, no re-download.",
  },
  {
    icon: ShieldCheck,
    title: "SHA-256 verified",
    description: "Every bundle is checksummed end to end so a corrupted or tampered package never installs.",
  },
  {
    icon: Lock,
    title: "Project isolation",
    description: "Each project gets its own scoped API keys and storage namespace — no cross-tenant leakage.",
  },
  {
    icon: Terminal,
    title: "CLI-first workflow",
    description: "`openota release` is the whole deploy step. Fits any CI pipeline you already run.",
  },
  {
    icon: Cloud,
    title: "Self-host or Cloud",
    description: "Run it on your own infrastructure today, or use OpenOTA Cloud when you don't want to.",
  },
  {
    icon: Wifi,
    title: "Real-time delivery",
    description: "A release reaches an already-open app over a live connection — no waiting for the next launch.",
  },
  {
    icon: LogIn,
    title: "Sign in with Google",
    description: "One click on the dashboard — links to your existing account if the email already matches.",
  },
];

const STEPS = [
  { step: "01", title: "Install the SDK", code: "npm install @openota/sdk" },
  { step: "02", title: "Configure once", code: "OTA.configure({ serverUrl, channel: 'production' })" },
  { step: "03", title: "Release from CI", code: "openota release --platform android" },
];

const PIPELINE_STEPS = [
  { num: "01", title: "Build", body: "Metro bundles JS + assets, hashes the output, writes a versioned manifest." },
  { num: "02", title: "Check", body: "Device asks your server for the active version against its own runtime version." },
  { num: "03", title: "Download", body: "Package streams to disk with live progress, resumable on flaky networks." },
  { num: "04", title: "Verify", body: "SHA-256 of the extracted bundle is checked against the signed manifest before anything runs." },
  { num: "05", title: "Activate", body: "Bundle swaps in on next launch; a boot-loop trips automatic rollback to the last good version." },
];

const WHY = [
  {
    title: "The App Store review queue is slow",
    body: "A one-line copy fix or a critical bug patch can sit in review for days. OpenOTA ships the JS change directly to installed apps — no binary resubmission, no waiting on a reviewer.",
  },
  {
    title: "But not every change should skip review",
    body: "Native code, new permissions, and anything Apple/Google require review for still goes through the store as normal. OpenOTA only ever touches the JS bundle — that boundary is enforced by the runtime, not a policy you have to remember.",
  },
  {
    title: "\"It worked in staging\" isn't good enough",
    body: "Every device independently re-verifies the SHA-256 checksum of what it downloaded before running it — the server's word alone is never trusted. If a release is bad, rollback is a local pointer swap, not a re-deploy.",
  },
];

const COMPARISON = [
  { label: "Where your data lives", openota: "Your server (self-hosted) or your own OpenOTA Cloud project", others: "Vendor's servers, always" },
  { label: "Vendor lock-in", openota: "None — plain REST API, open source, MIT licensed", others: "Tied to the vendor's platform and pricing" },
  { label: "Rollback", openota: "Instant, on-device, no re-download", others: "Varies — often a new deploy" },
  { label: "Bundle verification", openota: "SHA-256 re-checked on-device before running", others: "Varies by provider" },
  { label: "Self-hosting", openota: "First-class — same server code as Cloud", others: "Usually not offered" },
];

const FAQ = [
  {
    q: "Is this the same idea as CodePush or Expo Updates?",
    a: "Yes, same category — ship JS updates without an app store review. The differences: you own the server (self-host it or use OpenOTA Cloud, identical API either way), it's MIT-licensed and open source, and every device independently re-verifies a bundle's checksum before running it rather than trusting the server.",
  },
  {
    q: "Can I use this to skip App Store / Play Store review entirely?",
    a: "No — and neither can any OTA tool. Only JavaScript/asset changes can ship this way, by design and by platform policy. Native code changes, new permissions, and anything else that changes the compiled binary still require a normal store submission.",
  },
  {
    q: "What happens if a bad update ships?",
    a: "The native runtime tracks boot health — a bundle that crashes on launch triggers automatic rollback to the last known-good version, on-device, without waiting on you. You can also roll back manually from the CLI or the Cloud dashboard, which is a pointer change, not a new deploy.",
  },
  {
    q: "Do I need OpenOTA Cloud, or can I run this myself?",
    a: "Self-hosting is a first-class path, not an afterthought — docker compose up and you're running the exact same server code as Cloud. Use Cloud only if you'd rather not operate the infrastructure yourself.",
  },
  {
    q: "What does my React Native app actually need to install?",
    a: "The @openota/sdk package plus a handful of native modules it depends on (storage, filesystem, zip extraction, checksum verification) — see the full list and required native-rebuild steps on the docs page.",
  },
];

/** Real signal, not fabricated social proof — public endpoint, no auth needed. Cached for an hour
 * so this never adds meaningful latency or gets rate-limited by normal traffic. Silently omitted
 * (not a fake/zero badge) if GitHub is unreachable at build/request time. */
async function getGithubStars(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/HarshaJrDev/OpenOTA", {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const stars = await getGithubStars();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] grid-fade" />
      <div className="pointer-events-none absolute left-1/2 top-[-120px] -z-10 h-[520px] w-[820px] -translate-x-1/2 animate-glow-pulse rounded-full bg-gradient-to-br from-brand-from/40 via-brand-to/30 to-transparent blur-[120px]" />

      <SiteNav stars={stars} />
      <Hero />
      <Stack />
      <ProductPreview />
      <Why />
      <Features />
      <Pipeline />
      <HowItWorks />
      <Comparison />
      <Faq />
      <Cta />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-28 text-center">
      <FadeIn>
        <Badge variant="secondary" className="border border-border/60 px-3 py-1 text-xs font-medium">
          Open source · self-hosted or Cloud · MIT licensed
        </Badge>
      </FadeIn>

      <FadeIn delay={0.08}>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ship React Native updates
          <br />
          <span className="brand-gradient-text">instantly — no app store wait</span>
        </h1>
      </FadeIn>

      {/* Direct-answer summary, right under the H1 — the short "bottom line" a search engine or
          an AI assistant can lift verbatim, before any of the longer explanation below. */}
      <FadeIn delay={0.12}>
        <p className="mt-5 max-w-2xl rounded-full border border-border/60 bg-secondary/40 px-5 py-2.5 text-sm font-medium text-foreground/90 text-balance">
          In short: OpenOTA pushes JS/asset updates straight to installed React Native apps —
          usually live in under a minute — the same way a social app refreshes your feed, not the
          way an app store update works.
        </p>
      </FadeIn>

      <FadeIn delay={0.16}>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          OpenOTA delivers JS bundle updates over the air — instantly, verified, and reversible. Build a signed
          bundle, push it to your own server, and let installed apps sync, verify, and roll back on their own.
          Self-host it in ten minutes, or use{" "}
          <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
            OpenOTA Cloud
          </Link>{" "}
          and skip the infrastructure entirely.
        </p>
      </FadeIn>

      <FadeIn delay={0.24}>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href="#get-started">
              Get started free
              <ArrowRight />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/docs">Read the docs</Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <a href="https://github.com/HarshaJrDev/OpenOTA">View on GitHub</a>
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.32} className="mt-16 grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <Card className="mx-auto w-full max-w-lg overflow-hidden border-border/60 bg-card/80 p-0 text-left shadow-2xl shadow-brand-from/10 backdrop-blur">
          <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-xs text-muted-foreground">terminal</span>
          </div>
          <div className="group relative">
            <pre className="overflow-x-auto px-5 py-5 pr-12 font-mono text-sm leading-relaxed">
              <code>
                <span className="text-muted-foreground">$ </span>
                <span className="text-foreground">openota release --platform android</span>
                {"\n"}
                <span className="text-emerald-400">✔</span> Bundle created
                {"\n"}
                <span className="text-emerald-400">✔</span> Manifest generated · SHA256 verified
                {"\n"}
                <span className="text-emerald-400">✔</span> Uploaded to project-scoped storage
                {"\n"}
                <span className="text-muted-foreground"># live on every device within seconds</span>
              </code>
            </pre>
            <CopyButton
              value="openota release --platform android"
              label="release command"
              className="absolute right-2 top-2"
            />
          </div>
        </Card>

        {/* Real screenshot from the OpenOTA_Example reference app + a real push notification —
            not mockups. Same session that shipped this build sent this exact push to a physical
            Android emulator and confirmed delivery. */}
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <Image
            src="/screenshots/app-screen.png"
            alt="OpenOTA_Example React Native app showing the current OTA version, production channel, and an Up to date status, with Check for update, Sync, and Rollback buttons"
            width={1280}
            height={1550}
            className="w-full rounded-2xl border border-border/60 shadow-xl shadow-brand-from/10"
            priority
          />
          <Image
            src="/screenshots/push-notification.png"
            alt="Real Android push notification from OpenOTA reading New version available, v1.0.9 is ready, tap to update instantly — delivered while the app was fully closed"
            width={1280}
            height={830}
            className="w-full rounded-2xl border border-border/60 shadow-xl shadow-brand-from/10"
          />
          <p className="text-center text-xs text-muted-foreground">
            Real screenshots, not mockups — captured from{" "}
            <code className="rounded bg-muted px-1 py-0.5">OpenOTA_Example</code>, our own reference React Native
            app, during a live end-to-end test: publish a release, receive a real push notification, verify and
            activate on-device.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}

function Stack() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-20">
      <FadeIn className="flex flex-wrap items-center justify-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Built on</span>
        {STACK.map((name) => (
          <span
            key={name}
            className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground/80"
          >
            {name}
          </span>
        ))}
      </FadeIn>
    </section>
  );
}

function ProductPreview() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <FadeIn>
        <Card className="overflow-hidden border-border/60 bg-card/80 p-0 shadow-2xl shadow-brand-from/10 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-from" />
              <span className="text-sm font-medium">Environments</span>
              <Badge variant="secondary" className="text-xs">
                your-app
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">Cloud dashboard — illustrative preview</span>
          </div>
          <div className="grid divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {ENVIRONMENTS_PREVIEW.map((env) => (
              <div key={env.name} className="p-6">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{env.name}</span>
                  <Badge variant={env.name === "Production" ? "default" : "secondary"} className="text-xs capitalize">
                    {env.status}
                  </Badge>
                </div>
                <div className="mt-3 font-mono text-sm text-muted-foreground">v{env.version}</div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Rollout</span>
                    <span>{env.rollout}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full brand-gradient-bg" style={{ width: `${env.rollout}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  {env.devices} devices
                </div>
              </div>
            ))}
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={0.14} className="mt-4 text-center text-xs text-muted-foreground">
        Verification uses SHA-256, the hash function standardized in{" "}
        <a
          href="https://csrc.nist.gov/pubs/fips/180-4/upd1/final"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          NIST FIPS 180-4
        </a>
        , via Node.js&apos;s built-in <code>crypto</code> module server-side and the platform&apos;s native
        implementation on-device — no custom or unvetted hashing.
      </FadeIn>
    </section>
  );
}

function Why() {
  return (
    <section id="why" className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn className="text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why OpenOTA exists</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          If you&apos;ve never shipped an OTA update before, start here.
        </h2>
      </FadeIn>

      <div className="mt-14 space-y-6">
        {WHY.map((item, i) => (
          <FadeIn key={item.title} delay={i * 0.08}>
            <Card className="border-border/60 bg-card/60 p-6">
              <h3 className="font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.2} className="mt-8 text-center text-sm text-muted-foreground">
        See the full mechanics — bundle build, checksum verification, and rollback — on the{" "}
        <Link href="/docs#how-it-works" className="underline underline-offset-4 hover:text-foreground">
          how it works page
        </Link>
        , or jump straight to{" "}
        <Link href="/download" className="underline underline-offset-4 hover:text-foreground">
          downloading the CLI
        </Link>
        .
      </FadeIn>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Everything an OTA pipeline needs</h2>
        <p className="mt-4 text-muted-foreground">
          Built for teams who ship fast and can&apos;t afford a broken release to sit in the wild.
        </p>
      </FadeIn>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }, i) => (
          <FadeIn key={title} delay={i * 0.06}>
            <Card className="group h-full border-border/60 bg-card/60 p-6 transition-colors hover:border-brand-from/40 hover:bg-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:brand-gradient-bg">
                <Icon className="h-5 w-5 text-secondary-foreground transition-colors group-hover:text-white" />
              </div>
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </Card>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function Pipeline() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">The release pipeline</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Five steps, one command, no black box.</h2>
        <p className="mt-4 text-muted-foreground">
          <code>openota release</code> builds and uploads a versioned bundle; every installed app runs the same
          five steps to adopt it.
        </p>
      </FadeIn>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE_STEPS.map((step, i) => (
          <FadeIn key={step.num} delay={i * 0.07}>
            <Card className="h-full border-border/60 bg-card/60 p-5">
              <div className="text-2xl font-semibold text-muted-foreground/50">{step.num}</div>
              <h3 className="mt-2 font-medium">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.1} className="mt-6">
        <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:flex-nowrap">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              No black box — it&apos;s all just this
            </span>
            <code className="overflow-x-auto whitespace-nowrap font-mono text-xs text-muted-foreground">
              {"{ "}
              <span className="text-brand-from">bundleVersion</span>: <span className="text-emerald-400">&quot;1.2.0&quot;</span>,{" "}
              <span className="text-brand-from">platform</span>: <span className="text-emerald-400">&quot;android&quot;</span>,{" "}
              <span className="text-brand-from">sha256</span>: <span className="text-emerald-400">&quot;0d04b2…8a&quot;</span>
              {" }"}
            </code>
          </div>
        </Card>
      </FadeIn>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Three commands to your first release</h2>
      </FadeIn>

      <ol className="mt-14 space-y-4">
        {STEPS.map(({ step, title, code }, i) => (
          <li key={step}>
            <FadeIn delay={i * 0.08}>
              <Card className="flex flex-col items-start gap-4 border-border/60 bg-card/60 p-6 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full brand-gradient-bg text-sm font-semibold text-white">
                  {step}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium">{title}</h3>
                </div>
                <code className="w-full shrink-0 rounded-md bg-muted px-4 py-2 font-mono text-sm sm:w-auto">{code}</code>
              </Card>
            </FadeIn>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Comparison() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn className="text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">How it&apos;s different</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">OpenOTA vs. a hosted-only OTA vendor</h2>
        <p className="mt-4 text-muted-foreground">
          Same category as CodePush or Expo Updates — the difference is what you own.
        </p>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-12">
        <Card className="overflow-hidden border-border/60 bg-card/60 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>&nbsp;</TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded brand-gradient-bg text-[10px] font-bold text-white">
                      O
                    </span>
                    OpenOTA
                  </span>
                </TableHead>
                <TableHead className="text-muted-foreground">Typical hosted vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {row.openota}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="flex items-start gap-2">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
                      {row.others}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </FadeIn>
    </section>
  );
}

function Faq() {
  // FAQPage schema, generated straight from the same FAQ array the visible section renders —
  // there is no separate/hidden copy that could drift from what a real visitor actually reads.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FadeIn className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked</h2>
      </FadeIn>

      <div className="mt-12 space-y-4">
        {FAQ.map((item, i) => (
          <FadeIn key={item.q} delay={i * 0.05}>
            <Card className="border-border/60 bg-card/60 p-6">
              <h3 className="font-medium">{item.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
            </Card>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section id="get-started" className="mx-auto max-w-4xl px-6 pb-32">
      <FadeIn>
        <Card className="relative overflow-hidden border-border/60 bg-card/60 px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 animate-glow-pulse bg-gradient-to-br from-brand-from/15 via-transparent to-brand-to/15" />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl brand-gradient-bg">
            <Package className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight">Ready to ship your first OTA update?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Self-host OpenOTA in minutes, or spin up a project on OpenOTA Cloud — same SDK, same CLI, either way.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/docs">
                Read the docs
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/HarshaJrDev/OpenOTA">Star on GitHub</a>
            </Button>
          </div>
        </Card>
      </FadeIn>
    </section>
  );
}

