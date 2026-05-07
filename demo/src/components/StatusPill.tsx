import React from "react";
import { theme } from "../theme";

export type StatusKind = "in-progress" | "on-hold" | "done" | "archived";

// Maps to .status-pill[aria-selected="true"][data-color=...] in app.css.
const SELECTED: Record<StatusKind, { bg: string; border: string; fg: string }> = {
  "in-progress": { bg: theme.warningSoft, border: theme.warning, fg: theme.warning },
  "on-hold":     { bg: theme.dangerSoft,  border: theme.danger,  fg: theme.danger },
  "done":        { bg: theme.successSoft, border: theme.success, fg: theme.success },
  "archived":    { bg: "#2a2a30", border: "rgba(255,255,255,0.12)", fg: "#a1a1aa" },
};

const LABELS: Record<StatusKind, string> = {
  "in-progress": "In Progress",
  "on-hold":     "On Hold",
  "done":        "Completed",
  "archived":    "Archived",
};

interface Props {
  kind: StatusKind;
  selected: boolean;
  /** Optional override label */
  label?: string;
  /** 0..1 visual emphasis (for cross-fades or hover-fade) */
  opacity?: number;
  style?: React.CSSProperties;
}

/**
 * Single status pill matching `.status-pill` in app.css. Compact 11px font,
 * 5x10 padding, pill radius. Selected = filled with semantic palette;
 * unselected = transparent with a faint border.
 */
export const StatusPill: React.FC<Props> = ({ kind, selected, label, opacity = 1, style }) => {
  const p = SELECTED[kind];
  const bg = selected ? p.bg : "transparent";
  const border = selected ? p.border : theme.border;
  const fg = selected ? p.fg : theme.fg3;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontFamily: theme.fontBody,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: -0.01 * 11,
        whiteSpace: "nowrap",
        opacity,
        ...style,
      }}
    >
      {label ?? LABELS[kind]}
    </span>
  );
};
