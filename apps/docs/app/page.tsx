import {
  ArrowRight,
  Cloud,
  Github,
  Lock,
  Package,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";

import { FadeIn } from "./components/fade-in";

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
];

const STEPS = [
  { step: "01", title: "Install the SDK", code: "npm install @openota/sdk" },
  { step: "02", title: "Configure once", code: "OTA.configure({ serverUrl, channel: 'production' })" },
  { step: "03", title: "Release from CI", code: "openota release --platform android" },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] grid-fade" />
      <div className="pointer-events-none absolute left-1/2 top-[-120px] -z-10 h-[520px] w-[820px] -translate-x-1/2 animate-glow-pulse rounded-full bg-gradient-to-br from-brand-from/40 via-brand-to/30 to-transparent blur-[120px]" />

      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Cta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient-bg text-sm font-bold text-white">
            O
          </span>
          OpenOTA
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="https://github.com/HarshaJrDev/OpenOTA" className="transition-colors hover:text-foreground">
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a href="https://github.com/HarshaJrDev/OpenOTA">
              <Github />
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="#get-started">
              Get started
              <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-28 text-center">
      <FadeIn>
        <Badge variant="secondary" className="border border-border/60 px-3 py-1 text-xs font-medium">
          Now shipping OpenOTA Cloud (beta)
        </Badge>
      </FadeIn>

      <FadeIn delay={0.08}>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Ship React Native updates
          <br />
          <span className="brand-gradient-text">without the app store</span>
        </h1>
      </FadeIn>

      <FadeIn delay={0.16}>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          OpenOTA delivers JS bundle updates over the air — instantly, verified, and reversible. Self-host it
          in ten minutes, or use OpenOTA Cloud and skip the infrastructure entirely.
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
            <a href="https://github.com/HarshaJrDev/OpenOTA">View on GitHub</a>
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.32} className="mt-16 w-full">
        <Card className="mx-auto max-w-lg overflow-hidden border-border/60 bg-card/80 p-0 text-left shadow-2xl shadow-brand-from/10 backdrop-blur">
          <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-2 text-xs text-muted-foreground">terminal</span>
          </div>
          <pre className="overflow-x-auto px-5 py-5 font-mono text-sm leading-relaxed">
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
        </Card>
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

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-4xl px-6 py-24">
      <FadeIn className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Three commands to your first release</h2>
      </FadeIn>

      <div className="mt-14 space-y-4">
        {STEPS.map(({ step, title, code }, i) => (
          <FadeIn key={step} delay={i * 0.08}>
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
              <a href="https://github.com/HarshaJrDev/OpenOTA#readme">
                Read the docs
                <ArrowRight />
              </a>
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

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} OpenOTA. MIT licensed.</span>
        <div className="flex items-center gap-6">
          <a href="https://github.com/HarshaJrDev/OpenOTA" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
        </div>
      </div>
    </footer>
  );
}
