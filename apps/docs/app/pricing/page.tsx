import type { Metadata } from "next";
import { Check, Github, Minus, Server } from "lucide-react";
import Link from "next/link";

import { Badge } from "@openota/ui/badge";
import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@openota/ui/table";

import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Pricing — OpenOTA",
  description: "OpenOTA Cloud is free while in beta. Self-hosted is free forever, MIT licensed.",
};

// Every plan below reflects the real, current product — there is no live billing system yet, so
// every price is genuinely $0 or "Custom" (a real conversation, not a placeholder for a hidden
// number). No SLA/SSO/CDN/support-tier claims that aren't actually true today.
const PLANS = [
  {
    id: "cloud",
    name: "OpenOTA Cloud",
    tagline: "Zero infrastructure.",
    price: "$0",
    priceNote: "during beta",
    badge: "Recommended",
    includes: [
      "Hosted server — nothing to run yourself",
      "Managed Postgres + storage, backed up",
      "Same dashboard, same CLI, same SDK",
      "Create a project, get an API key, deploy",
    ],
    cta: { label: "Get started", href: "/download" },
  },
  {
    id: "managed",
    name: "Managed + Your Data",
    tagline: "OpenOTA runs the server. You keep your data.",
    price: "Custom",
    priceNote: "talk to us",
    includes: [
      "OpenOTA operates a dedicated server instance for you",
      "Your own database (bring your own Postgres)",
      "Your own storage bucket (bring your own Supabase Storage)",
      "Your own email credentials — never shared infrastructure",
      "Own subdomain, HTTPS managed by OpenOTA",
    ],
    cta: { label: "Contact us", href: "/contact" },
  },
  {
    id: "self-hosted",
    name: "Full Self-Hosted",
    tagline: "Run the complete stack yourself.",
    price: "$0",
    priceNote: "forever",
    includes: [
      "Full source, MIT licensed — no feature gate",
      "docker compose up -d — local disk + embedded DB by default",
      "Optional: point at your own Postgres / Supabase Storage",
      "Unlimited projects, releases, and devices",
      "Community support via GitHub Issues",
    ],
    cta: { label: "View on GitHub", href: "https://github.com/HarshaJrDev/OpenOTA", icon: Github },
  },
] as const;

// ✓ / — only, never invented numbers. Matches the real capabilities documented in docs/CLOUD.md
// and verified this session (checksum verification, rollback, real-time delivery are all real and
// identical across every tier — same server code, just different ownership of the data plane).
const COMPARISON = [
  { section: "Infrastructure" },
  { label: "Server", cloud: "OpenOTA", managed: "OpenOTA", selfHosted: "You" },
  { label: "Database", cloud: "OpenOTA", managed: "You", selfHosted: "You (or embedded default)" },
  { label: "Storage", cloud: "OpenOTA", managed: "You", selfHosted: "You (or local disk default)" },
  { label: "Domain & HTTPS", cloud: "OpenOTA", managed: "OpenOTA", selfHosted: "You" },
  { label: "Email", cloud: "OpenOTA", managed: "You", selfHosted: "You" },
  { section: "Core capabilities" },
  { label: "OTA updates", cloud: true, managed: true, selfHosted: true },
  { label: "On-device checksum verification", cloud: true, managed: true, selfHosted: true },
  { label: "Instant rollback", cloud: true, managed: true, selfHosted: true },
  { label: "Environments & staged rollouts", cloud: true, managed: true, selfHosted: true },
  { label: "Real-time WebSocket delivery", cloud: true, managed: true, selfHosted: true },
  { label: "Dashboard, CLI, SDK", cloud: true, managed: true, selfHosted: true },
  { section: "Support" },
  { label: "Support channel", cloud: "GitHub Issues", managed: "GitHub Issues", selfHosted: "GitHub Issues" },
] as const;

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-500" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default async function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] grid-fade" />
      <div className="pointer-events-none absolute left-1/2 top-[-120px] -z-10 h-[420px] w-[720px] -translate-x-1/2 animate-glow-pulse rounded-full bg-gradient-to-br from-brand-from/30 via-brand-to/20 to-transparent blur-[120px]" />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <FadeIn>
          <Badge variant="secondary" className="border border-border/60 px-3 py-1 text-xs font-medium">
            Early — pricing isn&apos;t final
          </Badge>
        </FadeIn>
        <FadeIn delay={0.08}>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Choose <span className="brand-gradient-text">how you run OpenOTA</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.16}>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            One server codebase, three ways to run it. OpenOTA doesn&apos;t have paid tiers yet — Cloud is free
            while in beta, self-hosting is free forever (it&apos;s MIT licensed). Real Cloud pricing will be
            announced here before anything ever starts costing money.
          </p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.id} delay={0.1 + i * 0.08}>
              <Card
                className={`flex h-full flex-col p-6 ${
                  "badge" in plan
                    ? "border-brand-from/40 bg-card/60 shadow-lg shadow-brand-from/10"
                    : "border-border/60 bg-card/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {plan.id === "self-hosted" && <Server className="h-4 w-4 text-brand-from" />}
                    <h2 className="text-lg font-semibold">{plan.name}</h2>
                  </div>
                  {"badge" in plan && <Badge className="text-xs">{plan.badge}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <div className="mt-4 text-3xl font-semibold">
                  {plan.price} <span className="text-base font-normal text-muted-foreground">{plan.priceNote}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6"
                  variant={"badge" in plan ? "default" : "outline"}
                  asChild
                >
                  <a href={plan.cta.href} className="gap-1.5">
                    {"icon" in plan.cta && <plan.cta.icon className="h-4 w-4" />}
                    {plan.cta.label}
                  </a>
                </Button>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <FadeIn className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Compare in detail</h2>
        </FadeIn>
        <FadeIn delay={0.08} className="mt-8 overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead className="text-center">Cloud</TableHead>
                <TableHead className="text-center">Managed</TableHead>
                <TableHead className="text-center">Self-Hosted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON.map((row, i) =>
                "section" in row ? (
                  <TableRow key={`section-${i}`} className="bg-secondary/40 hover:bg-secondary/40">
                    <TableCell colSpan={4} className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {row.section}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-center">
                      <ComparisonCell value={row.cloud} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ComparisonCell value={row.managed} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ComparisonCell value={row.selfHosted} />
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <FadeIn>
          <Card className="border-border/60 bg-card/60 p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Start for free today</h2>
            <p className="mt-3 text-muted-foreground">
              Deploy your first OTA update in minutes. No credit card, no billing setup.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/download">Get started</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1} className="mt-8 text-center text-sm text-muted-foreground">
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
