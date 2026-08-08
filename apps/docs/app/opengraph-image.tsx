import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "OpenOTA — Instant OTA updates for React Native";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Node runtime (not edge) specifically so this can read the real app icon off disk and embed it —
// the same file used for the favicon/Android launcher icons, not a hand-drawn approximation.
function loadIconDataUri(): string {
  const bytes = readFileSync(join(process.cwd(), "public", "icon.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export default function OpengraphImage() {
  const icon = loadIconDataUri();

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
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse requires a plain <img>, not next/image */}
          <img src={icon} width={100} height={100} style={{ borderRadius: 22 }} alt="" />
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
