import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { Providers } from "@/components/providers";
import { TrafficBeacon } from "@/components/traffic-beacon";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "OpenOTA Dashboard",
  description: "The developer platform for OpenOTA — packages, releases, devices, analytics.",
  // Authenticated app, not a marketing surface — project/release/API-key pages must never end up
  // in a search index.
  robots: { index: false, follow: false },
};

// Without this, mobile browsers assume a ~980px desktop layout and shrink the whole dashboard to
// fit — every `sm:`/`md:`/`lg:` Tailwind breakpoint then never actually triggers on a real phone.
// Same root cause already found and fixed on the marketing site (apps/docs); the dashboard had it
// too.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Analytics />
        <TrafficBeacon />
      </body>
    </html>
  );
}
