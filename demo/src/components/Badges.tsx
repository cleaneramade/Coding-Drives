import React from "react";
import { theme } from "../theme";

export type StackTint = "slate" | "green" | "blue" | "yellow" | "orange" | "violet" | "red";

const STACK_PALETTE: Record<StackTint, { bg: string; fg: string }> = {
  slate:  { bg: theme.tileSlateBg,  fg: theme.tileSlateFg },
  green:  { bg: theme.tileGreenBg,  fg: theme.tileGreenFg },
  blue:   { bg: theme.tileBlueBg,   fg: theme.tileBlueFg },
  yellow: { bg: theme.tileYellowBg, fg: theme.tileYellowFg },
  orange: { bg: theme.tileOrangeBg, fg: theme.tileOrangeFg },
  violet: { bg: theme.tileVioletBg, fg: theme.tileVioletFg },
  red:    { bg: theme.tileRedBg,    fg: theme.tileRedFg },
};

interface StackBadgeProps {
  label: string;
  tint?: StackTint;
}

/** Mirrors `.stack-badge` — 3×8 padding, 4px radius, 10px uppercase 700. */
export const StackBadge: React.FC<StackBadgeProps> = ({ label, tint = "slate" }) => {
  const p = STACK_PALETTE[tint];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 4,
        fontFamily: theme.fontBody,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 0.08 * 10,
        textTransform: "uppercase",
        background: p.bg,
        color: p.fg,
        border: `1px solid ${theme.borderSoft}`,
      }}
    >
      {label}
    </span>
  );
};

export type IndKind = "git" | "claude" | "vercel" | "env";

const IND_FG: Record<IndKind, string> = {
  git:    theme.tileOrangeFg,
  claude: theme.tileVioletFg,
  vercel: theme.fg1,
  env:    theme.tileGreenFg,
};

interface IndProps {
  kind: IndKind;
  label?: string;
}

/** Mirrors `.ind[data-kind=...]` — 2×6 padding, 4px radius, 10px uppercase. */
export const Indicator: React.FC<IndProps> = ({ kind, label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 6px",
      borderRadius: 4,
      fontFamily: theme.fontBody,
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: 0.08 * 10,
      textTransform: "uppercase",
      background: theme.surface2,
      color: IND_FG[kind],
      border: `1px solid ${theme.borderSoft}`,
    }}
  >
    {label ?? kind}
  </span>
);
