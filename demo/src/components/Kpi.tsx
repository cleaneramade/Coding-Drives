import React from "react";
import { theme } from "../theme";

export type KpiKind = "progress" | "on-hold" | "done" | "total";

// Per-kind palette mirrors .kpi[data-kind=...] in app.css exactly.
const PALETTE: Record<KpiKind, { bg: string; border: string; fg: string; label: string }> = {
  progress: { bg: theme.warningSoft,  border: theme.warning,   fg: theme.warning,    label: "In Progress" },
  "on-hold":{ bg: theme.dangerSoft,   border: theme.danger,    fg: theme.danger,     label: "On Hold" },
  done:     { bg: theme.successSoft,  border: theme.success,   fg: theme.success,    label: "Completed" },
  total:    { bg: theme.tileVioletBg, border: theme.brand500,  fg: theme.brand300,   label: "Total" },
};

interface Props {
  kind: KpiKind;
  /** Animated number — count-up driver. Rounded for display. */
  value: number;
  /** 0..1 entrance fade. */
  opacity?: number;
  /** Entrance translateY, in px. */
  translateY?: number;
  /** Optional flash overlay 0..1 (used for the live "+1" tick effect). */
  flash?: number;
}

/**
 * Compact KPI pill — matches `.kpi` in app.css. Number above label, both
 * tinted in the same semantic colour. Translucent fill on top of a coloured
 * border, exactly the same "soft pill" language as the per-card status pills.
 */
export const Kpi: React.FC<Props> = ({ kind, value, opacity = 1, translateY = 0, flash = 0 }) => {
  const p = PALETTE[kind];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "8px 14px",
        minWidth: 92,
        borderRadius: theme.radiusMd,
        background: p.bg,
        border: `1px solid ${p.border}`,
        opacity,
        transform: `translateY(${translateY}px) scale(${1 + flash * 0.04})`,
        boxShadow: flash > 0 ? `0 0 0 ${flash * 6}px ${p.bg}` : "none",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div
        style={{
          fontFamily: theme.fontDisplay,
          fontWeight: 700,
          fontSize: 19,
          lineHeight: 1,
          color: p.fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(value)}
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.08 * 9,
          textTransform: "uppercase",
          color: p.fg,
          opacity: 0.85,
          whiteSpace: "nowrap",
        }}
      >
        {p.label}
      </div>
    </div>
  );
};
