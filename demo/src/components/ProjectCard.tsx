import React from "react";
import { theme } from "../theme";
import { StatusPicker } from "./StatusPicker";
import { StatusKind } from "./StatusPill";
import { VendorButton } from "./VendorButton";
import { StackBadge, StackTint, Indicator, IndKind } from "./Badges";
import { IconButton, ExplorerIcon, DotsIcon } from "./IconButton";

export interface ProjectCardData {
  name: string;
  status: StatusKind;
  /** When set, the card animates the status picker from `status` → `morphTo`. */
  morphTo?: StatusKind;
  /** Stack badge rendered first in card-meta (e.g., "Next.js"). */
  stack: { label: string; tint: StackTint };
  /** Auxiliary indicators (GIT / ENV / CLAUDE / VERCEL). */
  indicators: IndKind[];
  path: string;
  /** Optional "last backup" timestamp shown next to the path pill. */
  lastBackup?: string;
}

interface Props {
  data: ProjectCardData;
  /** Card-level entrance opacity. */
  opacity?: number;
  translateY?: number;
  scale?: number;
  /** 0..1 — how far the status morph has progressed. */
  statusMorph?: number;
  /** Hover progress for each vendor button. */
  hoverProgress?: { vscode?: number; claude?: number; codex?: number };
  /** Hover progress for the Explorer / dots icon buttons. */
  iconHover?: { explorer?: number; dots?: number };
}

/**
 * Mirrors `<article class="card">` in public/index.html and the matching
 * `.card` CSS rules in app.css. Layout, paddings, and text sizes were lifted
 * from the live stylesheet so the rendered video and the running Electron
 * app are pixel-equivalent (within antialiasing).
 */
export const ProjectCard: React.FC<Props> = ({
  data,
  opacity = 1,
  translateY = 0,
  scale = 1,
  statusMorph = 0,
  hoverProgress = {},
  iconHover = {},
}) => {
  return (
    <article
      style={{
        position: "relative",
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radiusXl,
        padding: "18px 20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow:
          "0 4px 14px -6px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        minWidth: 0,
      }}
    >
      {/* card-head: title row + meta row */}
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* card-title-row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              fontFamily: theme.fontDisplay,
              fontWeight: 700,
              fontSize: 18,
              lineHeight: 1.2,
              color: theme.fg1,
              letterSpacing: -0.02 * 18,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {data.name}
          </h2>
          <div style={{ display: "inline-flex", gap: 6 }}>
            <IconButton hoverProgress={iconHover.explorer ?? 0}><ExplorerIcon /></IconButton>
            <IconButton hoverProgress={iconHover.dots ?? 0}><DotsIcon /></IconButton>
          </div>
        </div>

        {/* card-meta: stack-badge + indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <StackBadge label={data.stack.label} tint={data.stack.tint} />
          {data.indicators.length > 0 && (
            <span style={{ display: "inline-flex", gap: 6 }}>
              {data.indicators.map((kind) => (
                <Indicator key={kind} kind={kind} />
              ))}
            </span>
          )}
        </div>
      </header>

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: theme.fontBody,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.08 * 10,
            textTransform: "uppercase",
            color: theme.fg3,
            minWidth: 56,
          }}
        >
          Status
        </span>
        <StatusPicker selected={data.status} morphTo={data.morphTo} morph={statusMorph} />
      </div>

      {/* Path row + optional last-backup */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: theme.fontMono,
            fontSize: 10.5,
            color: theme.fg4,
            background: theme.bg2,
            border: `1px solid ${theme.borderSoft}`,
            borderRadius: theme.radiusSm,
            padding: "6px 8px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.path}
        </div>
        {data.lastBackup && (
          <span
            style={{
              flexShrink: 0,
              fontFamily: theme.fontMono,
              fontSize: 10.5,
              color: theme.fg4,
              whiteSpace: "nowrap",
            }}
          >
            {data.lastBackup}
          </span>
        )}
      </div>

      {/* Action row — 3-col vendor button grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 2 }}>
        <VendorButton vendor="vscode" hoverProgress={hoverProgress.vscode ?? 0} />
        <VendorButton vendor="claude" hoverProgress={hoverProgress.claude ?? 0} />
        <VendorButton vendor="codex"  hoverProgress={hoverProgress.codex  ?? 0} />
      </div>
    </article>
  );
};
