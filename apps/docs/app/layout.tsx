import type { Metadata } from "next";
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
const TITLE = "OpenOTA — Instant OTA updates for React Native";
const DESCRIPTION =
  "Ship JS bundle updates to your React Native app in seconds, without an app store review. Self-hosted or OpenOTA Cloud, project-isolated, checksum-verified on-device, with instant rollback.";

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
