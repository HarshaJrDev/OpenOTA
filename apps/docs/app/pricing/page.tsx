import type { Metadata } from "next";
import { Check, Github, Server } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";

import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Pricing — OpenOTA",
  description: "Self-hosted is free forever. OpenOTA Cloud is free while in beta.",
};

const SELF_HOSTED_INCLUDES = [
  "Full source, MIT licensed — no feature gate",
  "Unlimited projects, releases, and devices",
  "Your own Postgres + storage (local disk or Supabase)",
  "Staged rollouts, environments, deployment history",
  "Real-time WebSocket delivery",
  "Community support via GitHub Issues",
];

const CLOUD_INCLUDES = [
  "Hosted server — nothing to run yourself",
  "Managed Postgres + storage, backed up",
  "Same dashboard, same CLI, same SDK",
  "Everything self-hosted has, zero setup",
];

export default async function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-fade" />
      <SiteNav stars={null} activePath="/pricing" />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <FadeIn>
          <Badge variant="secondary" className="border border-border/60 px-3 py-1 text-xs font-medium">
            Early — pricing isn&apos;t final
          </Badge>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            <span className="brand-gradient-text">Free</span> to start, either way
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            OpenOTA doesn&apos;t have paid tiers yet. Self-hosting is free forever — it&apos;s open source. OpenOTA
            Cloud (the hosted version of the same server) is free while it&apos;s in beta. Real Cloud pricing will be
            announced here before anything ever starts costing money — nothing changes for you without notice.
          </p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          <FadeIn delay={0.1}>
            <Card className="flex h-full flex-col border-border/60 bg-card/60 p-6">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-brand-from" />
                <h2 className="text-lg font-semibold">Self-hosted</h2>
              </div>
              <div className="mt-3 text-3xl font-semibold">
                $0 <span className="text-base font-normal text-muted-foreground">forever</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Run the server yourself. MIT licensed — no feature is held back for a paid tier.
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {SELF_HOSTED_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-6" asChild>
                <a href="https://github.com/HarshaJrDev/OpenOTA" className="gap-1.5">
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </Card>
          </FadeIn>

          <FadeIn delay={0.18}>
            <Card className="flex h-full flex-col border-brand-from/40 bg-card/60 p-6 shadow-lg shadow-brand-from/10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">OpenOTA Cloud</h2>
                <Badge className="text-xs">Beta</Badge>
              </div>
              <div className="mt-3 text-3xl font-semibold">
                $0 <span className="text-base font-normal text-muted-foreground">during beta</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We host it for you. Same product, no infrastructure to manage.
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {CLOUD_INCLUDES.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-6" asChild>
                <Link href="/download">Get started</Link>
              </Button>
            </Card>
          </FadeIn>
        </div>

        <FadeIn delay={0.26} className="mt-10 text-center text-sm text-muted-foreground">
          Questions about what&apos;s coming?{" "}
          <Link href="/contact" className="text-foreground underline underline-offset-4 hover:no-underline">
            Get in touch
          </Link>
          .
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
