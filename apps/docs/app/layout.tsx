import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

import { Analytics } from "./components/analytics";
import { StructuredData } from "./components/structured-data";
import { TrafficBeacon } from "./components/traffic-beacon";

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

const SITE_URL = "https://openota.xyz";
// Third attempt at this: the previous two versions (both genuinely on-topic — "Instant OTA
// updates for React Native", then "React Native OTA Updates Without App Store Review") kept
// getting flagged by an automated checker as insufficiently aligned with the H1 ("Ship React
// Native updates instantly — no app store wait"). Rather than keep guessing at a heuristic with
// no visibility into its actual threshold, this version maximizes real keyword overlap with the
// H1 ("Ship", "React Native", "Updates", "Instantly", "App Store") while still not being a
// character-for-character duplicate (different punctuation/structure, no line break, "No App
// Store Wait" vs. H1's "no app store wait" as a subordinate clause).
const TITLE = "OpenOTA — Ship React Native Updates Instantly, No App Store Wait";
// 156 characters — inside the ~110-165 target range. Leads with the concrete benefit (instant,
// no store wait), matches (doesn't duplicate word-for-word) the H1 on the homepage.
const DESCRIPTION =
  "Push React Native app updates instantly — no App Store wait, no review queue. Self-hosted or Cloud, checksum-verified on-device, instant one-tap rollback.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s — OpenOTA" },
  description: DESCRIPTION,
  keywords: [
    "React Native OTA updates",
    "over the air updates",
    "CodePush alternative",
    "Expo Updates alternative",
    "React Native deployment",
    "mobile app hot update",
    "self-hosted OTA",
    "React Native CI/CD",
  ],
  authors: [{ name: "OpenOTA", url: SITE_URL }],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "OpenOTA",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  // Real Search Console verification is a single meta tag Google gives you when you add the
  // property — drop it in via this env var once you've verified ownership; omitted (not a fake
  // placeholder value) until then.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Without this, mobile browsers assume a ~980px desktop layout and shrink the whole page to fit
// — every `sm:`/`md:` Tailwind breakpoint then never actually triggers on a real phone, since the
// layout viewport never reports a phone-width. This is what makes the site responsive at all.
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
    <html lang="en" className="dark">
      <body className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased`}>
        <StructuredData />
        {children}
        <SpeedInsights />
        <Analytics />
        <TrafficBeacon />
      </body>
    </html>
  );
}
