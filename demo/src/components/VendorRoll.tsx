import React from "react";
import { theme } from "../theme";

interface Props {
  /** Continuous index 0..2 — fractional values produce the rolling transition. */
  index: number;
  /** Hero font size for the vendor name. */
  size?: number;
  /** Block-level opacity. */
  opacity?: number;
}

const VENDORS = [
  { name: "VS Code",     color: "#4FB1FF" },
  { name: "Claude Code", color: "#E8916C" },
  { name: "Codex",       color: "#F4F4F5" },
];

/**
 * Two-line vendor caption — STATIC "Open in" eyebrow above, hero vendor
 * name below. Each vendor name renders in its own absolute-positioned,
 * fully-centred row, so "Codex" (short) and "Claude Code" (long) both
 * sit on the same canvas X axis when active.
 *
 * The previous slot-machine implementation had a fixed-width slot driven
 * by the longest vendor's text, so shorter vendors drifted left of centre
 * when active. This layout doesn't have that problem — every vendor's
 * "row" is independently centred, and only the active one is visible
 * (others are vertically offset and faded).
 */
export const VendorRoll: React.FC<Props> = ({
  index,
  size = 84,
  opacity = 1,
}) => {
  // Slot height keeps neighbour rows tucked just out of view above/below.
  const slotH = size * 1.2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        opacity,
        // Wrapper takes full parent width so the slot below can also be
        // 100% wide — each vendor name is then absolutely positioned and
        // centred within that full-canvas-width slot, independent of the
        // eyebrow's natural width above.
        width: "100%",
      }}
    >
      {/* Static "Open in" eyebrow */}
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.22 * 14,
          textTransform: "uppercase",
          color: theme.fg3,
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: theme.brand400,
            boxShadow: `0 0 14px ${theme.brand400}`,
          }}
        />
        Open in
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: theme.brand400,
            boxShadow: `0 0 14px ${theme.brand400}`,
          }}
        />
      </div>

      {/* Vendor name slot — fixed-height stage, each vendor name absolutely
          positioned + centred + vertically offset by its distance from the
          active index. Only the row whose distance ≈ 0 is visible. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: slotH,
          // Soft top/bottom mask blurs the rolling edges so neighbour rows
          // appear to fade out as they leave the viewport rather than
          // hard-cutting at the slot boundary.
          maskImage:
            "linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, black 22%, black 78%, transparent 100%)",
        }}
      >
        {VENDORS.map((v, i) => {
          const dist = i - index;
          // Distance-based opacity — smoothly fades as the row leaves the
          // active slot. Falloff factor 1.6 keeps neighbours dim during
          // transitions without going fully invisible too soon.
          const op = Math.max(0, 1 - Math.abs(dist) * 1.6);
          const ty = dist * slotH;
          return (
            <div
              key={v.name}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: slotH,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: op,
                transform: `translateY(${ty}px)`,
                fontFamily: theme.fontDisplay,
                fontSize: size,
                fontWeight: 700,
                color: v.color,
                letterSpacing: -0.02 * size,
                lineHeight: 1,
                whiteSpace: "nowrap",
                willChange: "transform, opacity",
              }}
            >
              {v.name}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Helper: active vendor metadata for arrow accent / hover tint computations. */
export const vendorAt = (index: number) => {
  const clamped = Math.max(0, Math.min(VENDORS.length - 1, Math.round(index)));
  return VENDORS[clamped];
};
