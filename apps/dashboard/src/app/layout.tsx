import type { Metadata } from "next";
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
