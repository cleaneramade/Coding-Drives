import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { motion, theme } from "../theme";

export interface InfoPhase {
  /** Frame at which this phase begins its entrance animation. */
  startFrame: number;
  eyebrow: string;
  heading: string;
  subtitle: string;
  /** Optional accent colour for the eyebrow dots — defaults to brand violet. */
  accent?: string;
  /** When true the heading uses the mono font (used for the GitHub URL). */
  monoHeading?: boolean;
}

interface Props {
  phases: InfoPhase[];
  /** Strip height in px — defaults to 180. */
  height?: number;
  /** Max width of the centred content column — defaults to 1100. */
  maxWidth?: number;
}

/**
 * Bottom-anchored caption strip with cursor-synced text.
 *
 * Layout: a single centred column inside a max-width 1100 block.
 * Eyebrow + heading + subtitle stack vertically with text-align centre
 * and the column is vertically centred within the strip. This eliminates
 * the off-axis "tucked in the corner" feel.
 *
 * Motion: each child of the active phase animates with a spring driver,
 * staggered by 4-frame increments (eyebrow first, heading +4, subtitle +8).
 * Exits mirror this stagger backwards (subtitle leaves first, then heading,
 * then eyebrow). All three children share the same spring config so they
 * read as one unit moving rather than three independent fades.
 */
export const InfoStrip: React.FC<Props> = ({
  phases,
  height = 180,
  maxWidth = 1100,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height,
        // Top-fading gradient lifts the text off the dark page background
        // and integrates with the violet ambient. Sharper bottom band so
        // the heading sits on a confident substrate.
        background:
          "linear-gradient(180deg, rgba(11,11,14,0) 0%, rgba(11,11,14,0.60) 35%, rgba(11,11,14,0.92) 100%)",
        overflow: "hidden",
      }}
    >
      {/* Top-edge accent — 1px brand-tinted line gives the strip its own
          identity without competing with the device above. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(106,77,255,0) 0%, rgba(106,77,255,0.22) 30%, rgba(106,77,255,0.30) 50%, rgba(106,77,255,0.22) 70%, rgba(106,77,255,0) 100%)",
        }}
      />

      {phases.map((p, i) => {
        const next = phases[i + 1];

        // Springs run from the start frame, with stagger so each child
        // arrives a few frames after the previous. This produces a cascade
        // rather than three things popping in together.
        const springAt = (delay: number, exitOffset: number) => {
          const enter = spring({
            frame: frame - p.startFrame - delay,
            fps,
            config: motion.springFast,
          });
          // Exit progress: 0..1 over the 18 frames before the next phase's
          // start. Mirrored stagger so subtitle (exitOffset = 0) leaves first
          // and eyebrow (exitOffset = 8) leaves last. Smooth bezier easing.
          const exit = next
            ? interpolate(
                frame,
                [next.startFrame - 18 + exitOffset, next.startFrame + exitOffset],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: motion.ease.in,
                },
              )
            : 0;
          return { enter, exit };
        };

        // Stagger order: eyebrow first (delay 0), heading +4, subtitle +8.
        // Exit reverses: subtitle first (offset 0), heading +4, eyebrow +8.
        const eyebrowMot  = springAt(0, 8);
        const headingMot  = springAt(4, 4);
        const subtitleMot = springAt(8, 0);

        // Compose translate / scale / opacity from spring + exit.
        const composeTransform = (mot: { enter: number; exit: number }) => {
          // Enter: y goes 14 → 0, scale 0.97 → 1, opacity 0 → 1.
          const enterY = interpolate(mot.enter, [0, 1], [14, 0]);
          const enterScale = interpolate(mot.enter, [0, 1], [0.97, 1]);
          const enterOpacity = mot.enter;
          // Exit: y goes 0 → -10, scale 1 → 0.985, opacity 1 → 0.
          const exitY = mot.exit * -10;
          const exitScale = 1 - mot.exit * 0.015;
          const exitOpacity = 1 - mot.exit;
          return {
            transform: `translateY(${enterY + exitY}px) scale(${
              Math.min(enterScale, exitScale)
            })`,
            opacity: Math.min(enterOpacity, exitOpacity),
          };
        };

        const visible = Math.max(eyebrowMot.enter, headingMot.enter, subtitleMot.enter)
          - Math.max(eyebrowMot.exit, headingMot.exit, subtitleMot.exit);
        // Skip rendering offscreen phases entirely so we don't waste paint.
        if (visible <= 0.001) return null;

        const accent = p.accent ?? theme.brand400;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 60px",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* Eyebrow row — symmetric: dot · label · dot. Both dots use
                  the phase accent colour for a cohesive band of light at
                  the top of the centred column. */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  ...composeTransform(eyebrowMot),
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: accent,
                    boxShadow: `0 0 12px ${accent}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.22 * 11,
                    textTransform: "uppercase",
                    color: theme.fg3,
                  }}
                >
                  {p.eyebrow}
                </span>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: accent,
                    boxShadow: `0 0 12px ${accent}`,
                  }}
                />
              </div>

              {/* Heading — centred display face. The mono variant is used
                  only for the outro GitHub URL phase. */}
              <h2
                style={{
                  margin: "2px 0 0",
                  fontFamily: p.monoHeading ? theme.fontMono : theme.fontDisplay,
                  fontSize: p.monoHeading ? 36 : 44,
                  fontWeight: 700,
                  color: p.monoHeading ? theme.brand300 : theme.fg1,
                  letterSpacing: -0.02 * 44,
                  lineHeight: 1.08,
                  ...composeTransform(headingMot),
                }}
              >
                {p.heading}
              </h2>

              {/* Subtitle — supporting copy with a comfortable max-width so
                  long lines wrap naturally instead of stretching across the
                  whole strip. */}
              <p
                style={{
                  margin: 0,
                  maxWidth: 880,
                  fontFamily: theme.fontBody,
                  fontSize: 18,
                  fontWeight: 500,
                  color: theme.fg3,
                  lineHeight: 1.45,
                  letterSpacing: -0.005 * 18,
                  ...composeTransform(subtitleMot),
                }}
              >
                {p.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
