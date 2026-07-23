import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

interface Props {
  /** Optional ambient drift in px — pass from parent if elements should breathe. */
  driftX?: number;
  driftY?: number;
  children?: React.ReactNode;
}

/**
 * Page backdrop. Layers (back-to-front):
 *
 *  1. Solid `bg-2` base.
 *  2. Two violet radial gradients — same as `.ambient` in app.css.
 *  3. **Light streaks** — six soft diagonal violet lines that drift slowly.
 *     This is the v8 addition that fills the empty canvas with ambient
 *     motion so the composition no longer feels sparse.
 *  4. Dot grid pattern at ~3% opacity — adds texture without competing.
 *  5. Soft top/bottom vignette for caption + brand-mark substrate.
 */
export const Stage: React.FC<Props> = ({ driftX = 0, driftY = 0, children }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: theme.bg2, overflow: "hidden" }}>
      {/* Violet ambient — same two soft radials as the live app */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(60% 50% at 18% 18%, rgba(106,77,255,0.22) 0%, transparent 70%), radial-gradient(50% 40% at 82% 0%, rgba(167,139,250,0.10) 0%, transparent 70%), radial-gradient(40% 30% at 50% 100%, rgba(106,77,255,0.10) 0%, transparent 65%)",
          filter: "blur(2px)",
          transform: `translate3d(${driftX * 0.4}px, ${driftY * 0.4}px, 0)`,
        }}
      />

      {/* Light streaks — six diagonal beams with varied angles, lengths and
          drift speeds. Each is a thin elongated radial gradient rotated and
          translated based on the global frame so it appears to glide
          slowly across the canvas. */}
      <LightStreaks frame={frame} />

      {/* Dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          backgroundPosition: `${driftX * 0.6}px ${driftY * 0.6}px`,
          opacity: 0.85,
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.15) 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.15) 90%)",
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 82%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />

      {children}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Light streaks — six diagonal beams that drift slowly across the canvas.
// Each beam is an elongated rotated div with a soft edge gradient. Phase
// offsets are staggered so the beams don't move in lock-step.
// ─────────────────────────────────────────────────────────────────────────
interface Beam {
  /** Angle (degrees) the beam is rotated. */
  angle: number;
  /** Drift period in frames (full cycle across canvas). */
  period: number;
  /** Phase offset — fraction of a period 0..1. */
  phase: number;
  /** Vertical anchor as fraction of canvas height. */
  y: number;
  /** Width of the beam (the "thickness" line). */
  width: number;
  /** Length of the beam (extends past canvas edges so it sweeps fully). */
  length: number;
  /** Peak opacity. */
  opacity: number;
}

const BEAMS: Beam[] = [
  { angle: -18, period: 480, phase: 0.0, y: 0.18, width: 1.5, length: 2400, opacity: 0.16 },
  { angle: -22, period: 600, phase: 0.35, y: 0.42, width: 1.0, length: 2400, opacity: 0.12 },
  { angle: -16, period: 540, phase: 0.7, y: 0.72, width: 1.8, length: 2400, opacity: 0.18 },
  { angle: -25, period: 420, phase: 0.15, y: 0.88, width: 1.0, length: 2400, opacity: 0.10 },
  { angle: -14, period: 720, phase: 0.55, y: 0.30, width: 1.2, length: 2400, opacity: 0.14 },
  { angle: -20, period: 660, phase: 0.85, y: 0.62, width: 1.4, length: 2400, opacity: 0.13 },
];

const LightStreaks: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {BEAMS.map((b, i) => {
        // Phase 0..1 across the period. We move the beam horizontally from
        // -length/2 to +canvas+length/2 so it sweeps fully off both edges.
        const t = ((frame / b.period) + b.phase) % 1;
        const x = -300 + t * (1920 + 600); // -300..2220
        const y = b.y * 1080;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - b.length / 2,
              top: y - b.width / 2,
              width: b.length,
              height: b.width,
              transform: `rotate(${b.angle}deg)`,
              transformOrigin: "center center",
              // Each beam is a horizontal thin line with a fading-edge
              // gradient. Brand-violet core, transparent ends.
              background: `linear-gradient(90deg, transparent 0%, rgba(106,77,255,${b.opacity}) 40%, rgba(167,139,250,${b.opacity * 1.2}) 50%, rgba(106,77,255,${b.opacity}) 60%, transparent 100%)`,
              filter: "blur(0.6px)",
              opacity: 0.95,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
