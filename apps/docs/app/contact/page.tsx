import type { Metadata } from "next";
import { Github, Mail, MessageSquare } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Card } from "@openota/ui/card";

import { FadeIn } from "../components/fade-in";
import { SiteFooter, SiteNav } from "../components/site-nav";

export const metadata: Metadata = {
  title: "Contact — OpenOTA",
  description: "Report a bug, ask a question, or get in touch directly.",
};

const CONTACT_EMAIL = "developmet1043@gmail.com";

export default async function ContactPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-fade" />
      <SiteNav stars={null} />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
        <FadeIn>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Get in <span className="brand-gradient-text">touch</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.08}>
          <p className="mt-5 text-lg text-muted-foreground text-balance">
            No support ticket queue, no forms that go nowhere — just two ways to reach a real person.
          </p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          <FadeIn delay={0.1}>
            <Card className="flex h-full flex-col items-start gap-3 border-border/60 bg-card/60 p-6">
              <MessageSquare className="h-6 w-6 text-brand-from" />
              <h2 className="text-lg font-semibold">Bugs & feature requests</h2>
              <p className="text-sm text-muted-foreground">
                Found something broken, or want to request a feature? Open an issue — it&apos;s public, searchable,
                and the fastest way to get eyes on it.
              </p>
              <Button variant="outline" className="mt-auto gap-1.5" asChild>
                <a href="https://github.com/HarshaJrDev/OpenOTA/issues">
                  <Github className="h-4 w-4" />
                  Open a GitHub Issue
                </a>
              </Button>
            </Card>
          </FadeIn>

          <FadeIn delay={0.18}>
            <Card className="flex h-full flex-col items-start gap-3 border-border/60 bg-card/60 p-6">
              <Mail className="h-6 w-6 text-brand-from" />
              <h2 className="text-lg font-semibold">Everything else</h2>
              <p className="text-sm text-muted-foreground">
                Partnerships, security disclosures, or anything that shouldn&apos;t be a public issue — email
                directly.
              </p>
              <Button className="mt-auto gap-1.5" asChild>
                <a href={`mailto:${CONTACT_EMAIL}`}>
                  <Mail className="h-4 w-4" />
                  {CONTACT_EMAIL}
                </a>
              </Button>
            </Card>
          </FadeIn>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
