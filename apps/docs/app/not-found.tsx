import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@openota/ui/button";

import { FadeIn } from "./components/fade-in";
import { SiteFooter, SiteNav } from "./components/site-nav";

// Next.js renders this for any unmatched route automatically — no wiring needed elsewhere.
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] grid-fade" />
      <SiteNav stars={null} />

      <section className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <FadeIn>
          <span className="font-mono text-sm text-muted-foreground">404</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">This page doesn&apos;t exist</h1>
          <p className="mt-4 text-muted-foreground">
            No release, no rollback needed — just a page that was never built here. Try the docs or head back home.
          </p>
        </FadeIn>
        <FadeIn delay={0.08} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">
              Back to home
              <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/docs">Read the docs</Link>
          </Button>
        </FadeIn>
      </section>

      <SiteFooter />
    </div>
  );
}
