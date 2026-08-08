/**
 * OpenOTA brand palette. One source of truth for every screen/component — never hardcode a hex
 * value inline, import from here so a brand tweak is a one-file change.
 */
export const colors = {
  // Brand gradient (matches the OpenOTA app icon's blue-to-indigo download-arrow mark).
  brandStart: "#2E9BFF",
  brandEnd: "#0B2E6B",
  brand: "#EA580C",
  brandMuted: "#FFEDD5",

  // Surfaces
  bg: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceAlt: "#F0F3F9",
  border: "#E4E8F0",

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#5B6472",
  textTertiary: "#8A93A3",
  textInverse: "#FFFFFF",

  // Status
  success: "#16A34A",
  successMuted: "#DCFCE7",
  warning: "#D97706",
  warningMuted: "#FEF3C7",
  danger: "#DC2626",
  dangerMuted: "#FEE2E2",
  info: "#2563EB",
  infoMuted: "#DBEAFE",
  neutral: "#64748B",
  neutralMuted: "#F1F5F9",

  // Channel colors — matches the server's environment "color" field (green/amber/blue).
  channelGreen: "#16A34A",
  channelAmber: "#D97706",
  channelBlue: "#2563EB",
} as const;

export type ChannelColorName = "green" | "amber" | "blue" | "red" | "purple" | "gray";

export function channelColor(name: string | undefined): string {
  switch (name) {
    case "green":
      return colors.channelGreen;
    case "amber":
      return colors.channelAmber;
    case "blue":
      return colors.channelBlue;
    case "red":
      return colors.danger;
    case "purple":
      return "#7C3AED";
    default:
      return colors.neutral;
  }
}
