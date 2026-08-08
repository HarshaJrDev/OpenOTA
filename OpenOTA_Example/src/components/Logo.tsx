import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

/**
 * The OpenOTA mark, drawn as vector — a circular "sync" ring (indicating continuous delivery)
 * around a download arrow (indicating the OTA bundle landing on-device). Matches the app icon's
 * blue-to-navy gradient. Rendered as SVG, not a raster asset, so it's crisp at any size and never
 * needs @1x/@2x/@3x export management.
 */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="ring" x1="0" y1="0" x2="64" y2="64">
          <Stop offset="0" stopColor="#3AA6FF" />
          <Stop offset="1" stopColor="#0B2E6B" />
        </LinearGradient>
      </Defs>
      <Circle
        cx="32"
        cy="32"
        r="26"
        stroke="url(#ring)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="146 17"
        fill="none"
      />
      <Path
        d="M32 18 V38 M32 38 L24 30 M32 38 L40 30"
        stroke="url(#ring)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M21 44 h22" stroke="#0B2E6B" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}
