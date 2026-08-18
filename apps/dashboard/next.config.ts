import type { NextConfig } from "next";

// Real gap found in the Phase 2 security audit: the dashboard stores its session token in
// localStorage (deliberate — see lib/auth-token.ts's comment on why cookies don't work
// cross-domain here) with no CSP as a compensating control, unlike apps/docs which already has
// one. This mirrors that same, honest middle ground: 'unsafe-inline' for script-src/style-src
// because Next.js's own hydration payload relies on inline <script> tags (a nonce-based CSP would
// be stricter but needs per-request middleware this app doesn't have) — so this does NOT fully
// close off inline-script XSS reading localStorage, but it does block the more common vectors
// (loading an attacker-hosted external script, framing the dashboard in a hostile iframe, MIME-
// sniffing attacks). va.vercel-scripts.com is Vercel Analytics' own script; connect-src needs the
// API server's origin(s) since every dashboard request is a cross-origin fetch to it.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.openota.xyz https://openota.onrender.com https://va.vercel-scripts.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@openota/ui"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
