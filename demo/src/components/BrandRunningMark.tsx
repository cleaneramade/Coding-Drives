import React from "react";
import { theme } from "../theme";
import { BrandMark } from "./BrandMark";

interface Props {
  /** Per-frame opacity for the entire running mark. */
  opacity?: number;
  /** Size of the brand mark (the wordmark scales with it). */
  size?: number;
}

/**
 * Persistent top-left "running mark" used during scenes 2-4 once the
 * brand has settled. Mirrors the live app's titlebar credit treatment:
 * mark + thin label + product name. Anchors the brand without competing
 * with each scene's hero element.
 */
export const BrandRunningMark: React.FC<Props> = ({ opacity = 1, size = 40 }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: 64,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        pointerEvents: "none",
      }}
    >
      <BrandMark
        size={size}
        style={{ filter: "drop-shadow(0 6px 18px rgba(106,77,255,0.30))" }}
      />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontFamily: theme.fontBody,
            fontSize: 11,
            letterSpacing: 0.18 * 11,
            textTransform: "uppercase",
            color: theme.fg3,
            fontWeight: 700,
          }}
        >
          Project Tracker
        </span>
        <span
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 22,
            fontWeight: 700,
            color: theme.fg1,
            letterSpacing: -0.02 * 22,
            marginTop: 3,
          }}
        >
          Coding Drives
        </span>
      </div>
    </div>
  );
};
