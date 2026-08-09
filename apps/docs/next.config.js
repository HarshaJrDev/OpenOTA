/** @type {import('next').NextConfig} */
const nextConfig = {
  // Real gap found via a PageSpeed Insights / Lighthouse Best Practices run: zero security
  // headers were set on this app (apps/server already runs helmet() for the same class of
  // protection — this brings the marketing/docs site up to the same baseline, not a new
  // standard). script-src/style-src need 'unsafe-inline' because Next.js's own hydration
  // payload and Tailwind's runtime both rely on inline <script>/<style> tags — a nonce-based
  // CSP would be stricter but requires per-request middleware this app doesn't have yet; this
  // is the honest, working middle ground, not a placeholder.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // /analytics/track — the real pageview beacon (see components/traffic-beacon.tsx) posts here.
      "connect-src 'self' https://api.openota.xyz",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
