import type { Metadata } from "next";
import {
  Activity,
  Cloud,
  Database,
  History,
  Lock,
  RotateCcw,
  Server,
  ShieldCheck,
  Smartphone,
  Tag,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";

import { BreadcrumbJsonLd } from "../components/breadcrumb-jsonld";
import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Features — OpenOTA",
  description: "What OpenOTA actually does today, platform by platform.",
};

interface FeatureItem {
  icon: React.ElementType;
  title: string;
  description: string;
  status?: { label: string; variant: "default" | "secondary" | "outline" };
}

const CORE: FeatureItem[] = [
  {
    icon: Zap,
    title: "Instant OTA updates",
    description: "Ship a new JS bundle to every device in seconds — no app store review, no waiting.",
  },
  {
    icon: RotateCcw,
    title: "Native rollback",
    description: "Rolling back happens entirely on-device against a previously verified bundle — no re-download, no server round-trip.",
  },
  {
    icon: Tag,
    title: "Runtime version gating",
    description: "Every device reports a native runtimeVersion; a bundle is only ever offered to a device it's actually compatible with.",
  },
  {
    icon: Wifi,
    title: "Real-time delivery",
    description: "A release reaches an already-open app over a live WebSocket connection, not just on next cold start.",
  },
  {
    icon: Activity,
    title: "Silent updates",
    description: "Cold-start and background checks apply updates without a blocking prompt — the SDK's sync path never interrupts the user.",
  },
  {
    icon: ShieldCheck,
    title: "SHA-256 verified bundles",
    description: "Every package is checksummed end to end; a corrupted or tampered bundle is rejected before it ever installs.",
  },
];

const PLATFORMS: FeatureItem[] = [
  {
    icon: Smartphone,
    title: "React Native",
    description: "The SDK is a thin JS layer (OTA.configure/sync/check) that any React Native app can drop in.",
  },
  {
    icon: Smartphone,
    title: "Android",
    description: "Fully shipped — native bundle-swapping via @openota/native-android, verified end to end on real devices.",
  },
  {
    icon: Smartphone,
    title: "iOS",
    description: "The SDK's iOS bridge and server-side support exist, but there's no shipped native module yet — Android is what works today.",
    status: { label: "In progress", variant: "outline" },
  },
];

const OPERATIONS: FeatureItem[] = [
  {
    icon: Terminal,
    title: "CLI-first workflow",
    description: "openota init / doctor / release / rollback — most day-to-day work never needs the dashboard.",
  },
  {
    icon: Server,
    title: "Environments",
    description: "Production, staging, and development each track their own active release and rollout percentage per platform.",
  },
  {
    icon: History,
    title: "Release & rollback history",
    description: "Every release, rollback, and rollout change is logged per environment, newest first.",
  },
  {
    icon: Activity,
    title: "Analytics",
    description: "Downloads come from real device check-ins; install/failure/rollback counts come from the SDK reporting its own outcome — no synthetic numbers.",
  },
  {
    icon: Lock,
    title: "Project isolation",
    description: "Each project gets its own scoped API keys and storage namespace — no cross-tenant access.",
  },
];

const HOSTING: FeatureItem[] = [
  {
    icon: Cloud,
    title: "OpenOTA Cloud",
    description: "We host the server for you — same CLI, same SDK, same dashboard, nothing to run yourself.",
    status: { label: "Beta", variant: "secondary" },
  },
  {
    icon: Server,
    title: "Self-hosted",
    description: "Run the same server binary yourself. MIT licensed, no feature gate versus Cloud.",
  },
  {
    icon: Database,
    title: "Storage providers",
    description: "Local disk or Supabase Storage today. S3/R2/GCS aren't implemented yet — the provider interface exists, but only these two are wired in.",
  },
];

function FeatureGrid({ items }: { items: FeatureItem[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, description, status }, i) => (
        <FadeIn key={title} delay={i * 0.05}>
          <Card className="group h-full border-border/60 bg-card/60 p-6 transition-colors hover:border-brand-from/40 hover:bg-card">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary transition-colors group-hover:brand-gradient-bg">
                <Icon className="h-5 w-5 text-secondary-foreground transition-colors group-hover:text-white" />
              </div>
              {status && (
                <Badge variant={status.variant} className="text-xs">
                  {status.label}
                </Badge>
              )}
            </div>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </Card>
        </FadeIn>
      ))}
    </div>
  );
}

function FeatureSection({ eyebrow, title, items }: { eyebrow: string; title: string; items: FeatureItem[] }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <FadeIn>
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      </FadeIn>
      <div className="mt-10">
        <FeatureGrid items={items} />
      </div>
    </section>
  );
}

export default async function FeaturesPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-fade" />
      <BreadcrumbJsonLd items={[{ name: "Features", path: "/features" }]} />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-3xl px-6 pb-8 pt-20 text-center">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            What OpenOTA <span className="brand-gradient-text">actually does</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.08}>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            Every feature below reflects what&apos;s shipped today, not a roadmap. Where something is partial or
            in progress — like iOS — it&apos;s labeled that way instead of implied.
          </p>
        </FadeIn>
      </section>

      <FeatureSection eyebrow="Core" title="The OTA pipeline" items={CORE} />
      <FeatureSection eyebrow="Platforms" title="Where it runs" items={PLATFORMS} />
      <FeatureSection eyebrow="Operations" title="Running it in production" items={OPERATIONS} />
      <FeatureSection eyebrow="Hosting" title="Cloud or self-hosted" items={HOSTING} />

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <FadeIn>
          <Button size="lg" asChild>
            <Link href="/docs">Read the docs</Link>
          </Button>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
