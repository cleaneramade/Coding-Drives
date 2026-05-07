import React from "react";
import { theme } from "../theme";

interface Props {
  /** Canvas top-left position. Caller positions this so the popover
   *  appears just below the dots-menu icon it relates to. */
  x: number;
  y: number;
  /** 0..1 — entrance / exit scale, paired with `opacity`. */
  scale: number;
  /** 0..1 — fade in/out. */
  opacity: number;
  /** 0..1 — highlights the "Backup now" row when the cursor parks on it. */
  backupHover?: number;
}

/**
 * Mirrors the `.popover` rule from app.css — translucent glass surface,
 * 6-8px radius, 4 menu rows. The first row is "Backup now"; backupHover
 * brightens its background as the cursor approaches.
 *
 * The transform-origin is "top right" because the live app anchors the
 * popover to the dots-menu button's right edge — the entrance scale-in
 * therefore radiates from that anchor, the same direction your eye
 * tracks from "I clicked the icon" to "menu opened".
 */
export const CardMenuPopover: React.FC<Props> = ({
  x,
  y,
  scale,
  opacity,
  backupHover = 0,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 220,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: 6,
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 22px 50px -18px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "top right",
        pointerEvents: "none",
      }}
    >
      {/* Backup now (highlighted on hover) */}
      <PopoverItem
        icon={
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
          </svg>
        }
        label="Backup now"
        hover={backupHover}
      />
      {/* Archive (hide) */}
      <PopoverItem
        icon={
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h18M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M9 11h6" />
          </svg>
        }
        label="Archive (hide)"
      />
      {/* Copy path */}
      <PopoverItem
        icon={
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        }
        label="Copy path"
      />
      {/* Untrack — danger colour, mirrors .popover-danger */}
      <PopoverItem
        icon={
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4h6v3" />
          </svg>
        }
        label="Untrack (manual only)"
        danger
      />
    </div>
  );
};

const PopoverItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  hover?: number;
  danger?: boolean;
}> = ({ icon, label, hover = 0, danger = false }) => {
  const color = danger ? theme.danger : theme.fg1;
  const iconColor = danger ? theme.danger : theme.fg3;
  const bg = hover > 0
    ? `rgba(255,255,255,${0.04 + hover * 0.08})`
    : "transparent";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        fontSize: 13,
        fontFamily: theme.fontBody,
        color,
        borderRadius: 10,
        background: bg,
      }}
    >
      <span style={{ color: iconColor, display: "inline-flex" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
};
