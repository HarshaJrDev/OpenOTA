import type { Metadata } from "next";
import { Github, Mail } from "lucide-react";

import { Button } from "@openota/ui/button";

import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "About",
  description: "Why OpenOTA exists and who builds it.",
};

const CONTACT_EMAIL = "developmet1043@gmail.com";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] grid-fade" />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-2xl px-6 pb-24 pt-20">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            About <span className="brand-gradient-text">OpenOTA</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.08} className="mt-8 space-y-5 text-sm leading-relaxed text-muted-foreground">
          <p>
            OpenOTA started from a specific frustration: shipping a one-line JS fix to a React Native app still
            meant a full binary resubmission and a multi-day review queue, for a change that never touched native
            code at all. Existing OTA tools solved this, but tied you to their hosted infrastructure with no real
            self-hosting story.
          </p>
          <p>
            OpenOTA is the same idea — check, download, verify, activate, roll back, all without an app store
            review — built open source and self-hostable from day one. The exact same server code runs whether you
            deploy it yourself or use OpenOTA Cloud; there&apos;s no separate &quot;enterprise&quot; codebase held
            back from the open-source version.
          </p>
          <p>
            It&apos;s a solo-maintained, actively developed project — not a company with a sales team. Bugs get
            filed on GitHub, fixed in the open, and released the same way every other change ships.
          </p>
        </FadeIn>

        <FadeIn delay={0.16} className="mt-10 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href="https://github.com/HarshaJrDev/OpenOTA" className="gap-1.5" target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" />
              View source on GitHub
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={`mailto:${CONTACT_EMAIL}`} className="gap-1.5">
              <Mail className="h-4 w-4" />
              {CONTACT_EMAIL}
            </a>
          </Button>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
