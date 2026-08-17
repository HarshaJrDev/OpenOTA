import type { Metadata } from "next";
import { ArrowRight, Package, Smartphone, Terminal } from "lucide-react";
import Link from "next/link";

import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";

import { BreadcrumbJsonLd } from "../components/breadcrumb-jsonld";
import { CodeBlock } from "../components/code-block";
import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Download — OpenOTA",
  description: "Install the OpenOTA CLI, SDK, and native Android package.",
};

const PACKAGES = [
  {
    icon: Terminal,
    name: "CLI",
    pkg: "@openota/cli",
    install: "npm install -g @openota/cli",
    description: "Release, rollback, and manage projects from your terminal or CI pipeline.",
  },
  {
    icon: Package,
    name: "SDK",
    pkg: "@openota/sdk",
    install: "npm install @openota/sdk",
    description: "Drop into any React Native app to check for and apply OTA updates.",
  },
  {
    icon: Smartphone,
    name: "Native (Android)",
    pkg: "@openota/native-android",
    install: "npm install @openota/native-android",
    description: "Native module the SDK uses on Android to swap bundles at runtime.",
  },
];

export default async function DownloadPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-fade" />
      <BreadcrumbJsonLd items={[{ name: "Download", path: "/download" }]} />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            There&apos;s no app to <span className="brand-gradient-text">download</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.08}>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            OpenOTA ships as npm packages you add to your own React Native project — a CLI for releasing, an SDK for
            the app, and a native module for Android. Install what you need below.
          </p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {PACKAGES.map(({ icon: Icon, name, pkg, install, description }) => (
            <FadeIn key={pkg} delay={0.1}>
              <Card className="flex h-full flex-col gap-3 border-border/60 bg-card/60 p-6">
                <Icon className="h-6 w-6 text-brand-from" />
                <h2 className="text-lg font-semibold">{name}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
                <CodeBlock
                  code={install}
                  label={`${name} install command`}
                  className="mt-auto"
                  preClassName="rounded-lg border border-border/60 bg-black/40 px-3 py-2 pr-9 text-xs"
                />
              </Card>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.24} className="mt-10 text-center">
          <Button asChild>
            <Link href="/docs" className="gap-1.5">
              Read the Quickstart
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
