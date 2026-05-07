// Mirrors the live app's design tokens (public/ds/colors_and_type.css) so the
// rendered video and the running Electron app stay visually identical.

import { Easing } from "remotion";

// Apple-keynote-style motion tokens. One shared bezier family + two spring
// presets keeps the whole composition on the same motion language so it
// reads as cohesive rather than a series of independent animations.
export const motion = {
  ease: {
    // ease-out-quart: fast in, smooth deceleration. Default for entrances.
    out:   Easing.bezier(0.16, 1.0, 0.3,  1.0),
    // ease-in-quart: smooth start, accelerated exit. Default for exits.
    in:    Easing.bezier(0.7,  0.0, 0.84, 0.0),
    // ease-in-out-quart: balanced for cursor pathing between waypoints.
    inOut: Easing.bezier(0.65, 0.0, 0.35, 1.0),
    // Gentler ease-in-out — closer to a sine curve. Used for transitions
    // where snappiness reads as choppy (vendor roll, caption swaps).
    smooth: Easing.bezier(0.45, 0.0, 0.55, 1.0),
  },
  // Slow + heavy: device entrance, card settle.
  springSlow: { mass: 1.0, damping: 22, stiffness: 90 },
  // Faster, slightly bouncy: text in/out, KPI counter arrival.
  springFast: { mass: 0.6, damping: 16, stiffness: 130 },
};

export const theme = {
  bg:        "#131316",
  bg2:       "#0b0b0e",
  fg1:       "#fafafa",
  fg2:       "#d4d4d8",
  fg3:       "#a1a1aa",
  fg4:       "#71717a",

  brand300:  "#c4b5ff",
  brand400:  "#a08aff",
  brand500:  "#6a4dff",
  brand600:  "#5b3eef",
  brand700:  "#5538e0",

  // App surface uses a 3-stop diagonal gradient, NOT a flat colour.
  surface:   "linear-gradient(135deg, rgba(32,32,40,0.97) 0%, rgba(28,28,36,0.95) 60%, rgba(24,24,32,0.93) 100%)",
  surface1:  "rgba(255,255,255,0.03)",
  surface2:  "rgba(255,255,255,0.06)",
  surface3:  "rgba(255,255,255,0.10)",
  border:    "rgba(255,255,255,0.08)",
  borderSoft:"rgba(255,255,255,0.04)",
  ring:      "rgba(255,255,255,0.15)",

  success:   "#34d399",
  warning:   "#fbbf24",
  danger:    "#f87171",
  info:      "#60a5fa",

  // Soft semantic backgrounds used for status pills + KPI fills
  successSoft: "rgba(52,211,153,0.18)",
  warningSoft: "rgba(251,191,36,0.18)",
  dangerSoft:  "rgba(248,113,113,0.18)",
  infoSoft:    "rgba(96,165,250,0.18)",

  // Stack-badge tints
  tileSlateBg: "rgba(255,255,255,0.10)",
  tileSlateFg: "#fafafa",
  tileGreenBg: "rgba(34,197,94,0.20)",
  tileGreenFg: "#86efac",
  tileBlueBg:  "rgba(59,130,246,0.18)",
  tileBlueFg:  "#93c5fd",
  tileYellowBg:"rgba(234,179,8,0.20)",
  tileYellowFg:"#fde047",
  tileOrangeBg:"rgba(249,115,22,0.20)",
  tileOrangeFg:"#fdba74",
  tileVioletBg:"rgba(106,77,255,0.18)",
  tileVioletFg:"#c4b5ff",
  tileRedBg:   "rgba(220,38,38,0.22)",
  tileRedFg:   "#fca5a5",

  radiusXs: 6,
  radiusSm: 10,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,

  fontBody:    "'Inter', system-ui, sans-serif",
  fontDisplay: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
  fontMono:    "'Geist Mono', ui-monospace, monospace",

  // Vendor-button gradients (lifted directly from app.css)
  vscodeGrad: "linear-gradient(180deg, #1A8FDC, #007ACC)",
  claudeGrad: "linear-gradient(180deg, #E08762, #D97757)",
  codexGrad:  "linear-gradient(180deg, #ffffff, #f1f1f1)",
} as const;

// Page-wide backdrop: violet ambient on near-black, like the running app.
export const backdropStyle: React.CSSProperties = {
  background: `
    radial-gradient(60% 50% at 18% 18%, rgba(106,77,255,0.18), transparent 70%),
    radial-gradient(50% 40% at 82% 0%, rgba(167,139,250,0.10), transparent 70%),
    ${theme.bg2}
  `,
};
