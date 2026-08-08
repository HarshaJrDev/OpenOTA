import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OpenOTA — Instant OTA updates for React Native";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated at request time via Satori (next/og), not a static asset — so it stays correct
// without anyone remembering to re-export a PNG by hand. Colors are the same blue-to-navy
// gradient as the app icon/mobile client Logo component, kept in sync deliberately.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #05070d 0%, #0b1220 55%, #0b2e6b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="84" height="84" viewBox="0 0 64 64" fill="none">
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="url(#g)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="146 17"
              fill="none"
            />
            <path
              d="M32 18 V38 M32 38 L24 30 M32 38 L40 30"
              stroke="url(#g)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M21 44 h22" stroke="#0B2E6B" strokeWidth="6" strokeLinecap="round" />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0" stopColor="#3AA6FF" />
                <stop offset="1" stopColor="#0B2E6B" />
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontSize: 72, fontWeight: 700, color: "white", letterSpacing: -2 }}>OpenOTA</span>
        </div>
        <span style={{ marginTop: 28, fontSize: 32, color: "#9db3d6", maxWidth: 820, textAlign: "center" }}>
          Instant, verified, reversible OTA updates for React Native
        </span>
        <span style={{ marginTop: 20, fontSize: 22, color: "#5b7599" }}>
          Self-hosted or Cloud · Open source · MIT licensed
        </span>
      </div>
    ),
    { ...size },
  );
}
