import { ArrowRight, Download, Github, Mail, Star, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@openota/ui/button";

/** Shared across every page so nav/footer stay in sync in one place instead of copies drifting apart. */
export function SiteNav({ stars }: { stars: number | null }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Image src="/icon.png" alt="" width={28} height={28} className="rounded-lg" priority />
          OpenOTA
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            Landing Page
          </Link>
          <Link href="/features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Documentation
          </Link>
          <a href="https://github.com/HarshaJrDev/OpenOTA" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <Link href="/download" className="transition-colors hover:text-foreground">
            Download
          </Link>
          <Link href="/contact" className="transition-colors hover:text-foreground">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <a href="https://github.com/HarshaJrDev/OpenOTA" className="gap-1.5">
              <Github />
              {stars !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {stars.toLocaleString()}
                </span>
              )}
            </a>
          </Button>
          <Button size="sm" asChild>
            <Link href="/download">
              Get started
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
        <span>
          © {new Date().getFullYear()} OpenOTA. Built by Harsha. MIT licensed.{" "}
          <span className="text-muted-foreground/70">· Page last updated August 9, 2026</span>
        </span>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <a href="https://github.com/HarshaJrDev/OpenOTA" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Documentation
          </Link>
          <Link href="/pricing" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Tag className="h-3.5 w-3.5" />
            Pricing
          </Link>
          <Link href="/download" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
            Download
          </Link>
          <Link href="/contact" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Mail className="h-3.5 w-3.5" />
            Contact
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/40 px-6 pt-6 text-xs text-muted-foreground/80 sm:justify-start">
        <Link href="/about" className="transition-colors hover:text-foreground">
          About
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/cookies" className="transition-colors hover:text-foreground">
          Cookie Policy
        </Link>
        <Link href="/disclaimer" className="transition-colors hover:text-foreground">
          Disclaimer
        </Link>
      </div>
    </footer>
  );
}
