import React from "react";
import { theme, backdropStyle } from "../theme";
import { Kpi, KpiKind } from "./Kpi";
import { BrandMark } from "./BrandMark";

export interface KpiState {
  kind: KpiKind;
  value: number;
  flash?: number;
}

interface Props {
  /** KPI values currently displayed (animated by the timeline). */
  kpis: KpiState[];
  /** App-shell paint-in 0..1 — fades chrome from black to live. */
  paintIn?: number;
  /** Currently selected status filter chip — defaults to "All". */
  selectedFilter?: string;
  /** What renders inside <main class="grid"> — the timeline supplies cards. */
  children: React.ReactNode;
}

/**
 * Mirrors the live Coding Drives chrome: titlebar (traffic lights + credit
 * pill), topbar (brand cluster + KPI row), filters strip (search + status
 * chips + Add Project + Scan + Settings), and a grid container.
 *
 * `paintIn` is the only animation knob — fades the whole chrome up from
 * black so the timeline can do a "the screen powers on" beat.
 */
export const AppShell: React.FC<Props> = ({ kpis, paintIn = 1, selectedFilter = "All", children }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        ...backdropStyle,
        // The whole shell fades up. Inner chrome animations (KPI counters,
        // card stagger) are layered on top of this.
        opacity: paintIn,
        fontFamily: theme.fontBody,
        color: theme.fg1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Titlebar — traffic lights + credit pill */}
      <div
        style={{
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px 0 18px",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "inline-flex", gap: 9 }}>
          {[
            { bg: "#ed6a5f" },
            { bg: "#f6be50" },
            { bg: "#61c555" },
          ].map((tl, i) => (
            <span
              key={i}
              style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: tl.bg,
                border: "1px solid rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "3px 5px 3px 12px",
            fontSize: 11,
            color: theme.fg3,
            fontWeight: 500,
            background: theme.surface2,
            border: `1px solid ${theme.border}`,
            borderRadius: 999,
            letterSpacing: -0.01 * 11,
          }}
        >
          <span>Made by @cleaneramade</span>
          <BrandMark size={20} style={{ filter: "drop-shadow(0 2px 6px rgba(106,77,255,0.30))" }} />
        </span>
      </div>

      {/* Topbar — brand + KPI row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 36px 18px",
          gap: 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <BrandMark size={48} style={{ filter: "drop-shadow(0 6px 18px rgba(106,77,255,0.30))" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 0.08 * 11,
                textTransform: "uppercase",
                color: theme.fg3,
                fontWeight: 700,
              }}
            >
              Project Tracker
            </span>
            <h1
              style={{
                fontFamily: theme.fontDisplay,
                fontWeight: 700,
                fontSize: 30,
                lineHeight: 1,
                letterSpacing: -0.02 * 30,
                color: theme.fg1,
                margin: "4px 0 0",
              }}
            >
              Coding Drives
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          {kpis.map((k) => (
            <Kpi key={k.kind} kind={k.kind} value={k.value} flash={k.flash ?? 0} />
          ))}
        </div>
      </div>

      {/* Filters row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 36px 24px",
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 280px" }}>
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            stroke={theme.fg3}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <div
            style={{
              padding: "10px 14px 10px 36px",
              fontSize: 13,
              color: theme.fg3,
              background: theme.surface2,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radiusMd,
            }}
          >
            Search projects…
          </div>
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", gap: 8, flex: "1 1 auto" }}>
          {[
            { label: "All", count: 23 },
            { label: "In Progress", count: 7 },
            { label: "On Hold", count: 2 },
            { label: "Completed", count: 14 },
          ].map((chip) => {
            const sel = chip.label === selectedFilter;
            return (
              <span
                key={chip.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: -0.01 * 12,
                  background: sel ? theme.brand500 : theme.surface2,
                  border: `1px solid ${sel ? "transparent" : theme.border}`,
                  borderRadius: 999,
                  color: sel ? "#fff" : theme.fg2,
                  boxShadow: sel ? "0 6px 18px -8px rgba(106,77,255,0.30)" : "none",
                }}
              >
                <span>{chip.label}</span>
                <span style={{ fontFamily: theme.fontBody, fontVariantNumeric: "tabular-nums", fontWeight: 700, opacity: 0.85 }}>
                  {chip.count}
                </span>
              </span>
            );
          })}
        </div>

        {/* Add Project (brand) */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: `linear-gradient(180deg, ${theme.brand500}, ${theme.brand600})`,
            border: "1px solid transparent",
            borderRadius: theme.radiusMd,
            boxShadow: "0 6px 18px -8px rgba(106,77,255,0.30)",
            letterSpacing: -0.01 * 13,
          }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Add Project</span>
        </span>

        {/* Scan + Settings (secondary) */}
        {[
          { label: "Scan", icon: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></> },
          { label: "Settings", icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></> },
        ].map((b) => (
          <span
            key={b.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: theme.fg1,
              background: theme.surface2,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radiusMd,
              letterSpacing: -0.01 * 13,
            }}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {b.icon}
            </svg>
            <span>{b.label}</span>
          </span>
        ))}
      </div>

      {/* Grid container */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 18,
          padding: "0 36px 36px",
          position: "relative",
          zIndex: 1,
          alignContent: "start",
        }}
      >
        {children}
      </main>
    </div>
  );
};
