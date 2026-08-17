"use client";

import { ArrowRight, Download, Github, Mail, Menu, Star, Tag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@openota/ui/button";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Documentation" },
  { href: "/download", label: "Download" },
  { href: "/contact", label: "Contact" },
];

// Shared by every plain text link in the nav/footer so keyboard focus gets the same themed ring
// as every Button in the design system, instead of silently falling back to the browser's default
// (unstyled, untested-against-our-palette) focus outline.
const LINK_FOCUS =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Shared across every page so nav/footer stay in sync in one place instead of copies drifting apart. */
export function SiteNav({ stars }: { stars: number | null }) {
  const [open, setOpen] = useState(false);

  // Close the mobile panel on route change / escape, and stop body scroll while it's open —
  // otherwise the page behind a full-screen mobile menu keeps scrolling underneath it.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-lg"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className={`flex items-center gap-2 font-semibold tracking-tight ${LINK_FOCUS}`}
          onClick={() => setOpen(false)}
        >
          <Image src="/icon.png" alt="OpenOTA logo" width={28} height={28} className="rounded-lg" priority />
          OpenOTA
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/HarshaJrDev/OpenOTA"
            className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <a href="https://github.com/HarshaJrDev/OpenOTA" className="gap-1.5" target="_blank" rel="noopener noreferrer">
              <Github />
              {stars !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {stars.toLocaleString()}
                </span>
              )}
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <a href="https://dashboard.openota.xyz">Dashboard</a>
          </Button>
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/download">
              Get started
              <ArrowRight />
            </Link>
          </Button>

          {/* Mobile-only trigger — the desktop <nav> above is `hidden` below md, so this is the
              only way to reach any nav link (including Dashboard) on a phone-width viewport.
              h-11 w-11 (44px) meets the standard minimum touch-target size; the visible icon stays
              20px via the inner span so it doesn't look oversized. */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-md border border-border/60 text-foreground md:hidden ${LINK_FOCUS}`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel — full-width dropdown under the header, same link set as desktop nav plus
          the CTAs that are otherwise `hidden sm:inline-flex` at this width. */}
      {open && (
        <div
          className="border-t border-border/60 bg-background md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted ${LINK_FOCUS}`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://dashboard.openota.xyz"
              className={`rounded-md px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted ${LINK_FOCUS}`}
            >
              Dashboard
            </a>
            <a
              href="https://github.com/HarshaJrDev/OpenOTA"
              className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-base text-foreground transition-colors hover:bg-muted ${LINK_FOCUS}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              GitHub
              {stars !== null && (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  {stars.toLocaleString()}
                </span>
              )}
            </a>
            <Button size="sm" asChild className="mt-2">
              <Link href="/download" onClick={() => setOpen(false)}>
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2.5rem)" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <span className="text-center sm:text-left">
          © {new Date().getFullYear()} OpenOTA. Built by Harsha. MIT licensed.{" "}
          <span className="text-muted-foreground">· Page last updated August 9, 2026</span>
        </span>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a
            href="https://github.com/HarshaJrDev/OpenOTA"
            className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${LINK_FOCUS}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
          <Link href="/docs" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
            Documentation
          </Link>
          <a href="https://dashboard.openota.xyz" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
            Dashboard
          </a>
          <Link href="/pricing" className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${LINK_FOCUS}`}>
            <Tag className="h-3.5 w-3.5" />
            Pricing
          </Link>
          <Link href="/download" className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${LINK_FOCUS}`}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Link>
          <Link href="/contact" className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${LINK_FOCUS}`}>
            <Mail className="h-3.5 w-3.5" />
            Contact
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/40 px-4 pt-6 text-xs text-muted-foreground sm:justify-start sm:px-6">
        <Link href="/about" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
          About
        </Link>
        <Link href="/privacy" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
          Terms of Service
        </Link>
        <Link href="/cookies" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
          Cookie Policy
        </Link>
        <Link href="/disclaimer" className={`transition-colors hover:text-foreground ${LINK_FOCUS}`}>
          Disclaimer
        </Link>
      </div>
    </footer>
  );
}
