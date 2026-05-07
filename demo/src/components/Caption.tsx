import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { motion, theme } from "../theme";

interface Props {
  /** First frame at which the caption begins its entrance. */
  startFrame: number;
  /** First frame at which the caption begins its exit (defaults: stays). */
  endFrame?: number;
  eyebrow?: string;
  heading: string;
  /** Optional supporting line below the heading. */
  subtitle?: string;
  /** Accent colour for the eyebrow dots. */
  accent?: string;
  /** Heading font size — defaults to 64. */
  headingSize?: number;
  /** Render the heading in mono font (used for the GitHub URL outro). */
  monoHeading?: boolean;
  /** Subtitle width cap. */
  subtitleMaxWidth?: number;
}

/**
 * Hero caption block — eyebrow + heading + (optional) subtitle.
 *
 * The caption fills its parent (`position: absolute; inset: 0`) and
 * vertically + horizontally centres its content. So putting it inside a
 * flex slot of any size positions it correctly within the centred
 * composition. No `top` prop, no canvas-anchored positioning — the
 * parent decides where the slot lives.
 *
 * Motion: spring-driven cascade. Eyebrow rises first, then heading 4
 * frames later, then subtitle 8 frames later. Exit reverses so the
 * cascade reads as continuous through phase changes.
 */
export const Caption: React.FC<Props> = ({
  startFrame,
  endFrame,
  eyebrow,
  heading,
  subtitle,
  accent = theme.brand400,
  headingSize = 64,
  monoHeading = false,
  subtitleMaxWidth = 880,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Per-element spring + exit progress. Exit window is 24 frames (was 18)
  // so caption swaps feel like a continuous handoff rather than a pop.
  const segment = (delay: number, exitDelay: number) => {
    const enter = spring({
      frame: frame - startFrame - delay,
      fps,
      config: motion.springFast,
    });
    const exit = endFrame
      ? interpolate(
          frame,
          [endFrame + exitDelay - 24, endFrame + exitDelay],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: motion.ease.smooth },
        )
      : 0;
    const enterY = interpolate(enter, [0, 1], [16, 0]);
    const enterScale = interpolate(enter, [0, 1], [0.97, 1]);
    const opacity = Math.max(0, enter - exit);
    const exitY = exit * -10;
    return {
      transform: `translateY(${enterY + exitY}px) scale(${enterScale})`,
      opacity,
    };
  };

  const eyebrowMot  = segment(0, 8);
  const headingMot  = segment(4, 4);
  const subtitleMot = segment(8, 0);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {eyebrow && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            ...eyebrowMot,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 14px ${accent}`,
            }}
          />
          <span
            style={{
              fontFamily: theme.fontBody,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.22 * 12,
              textTransform: "uppercase",
              color: theme.fg3,
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: accent,
              boxShadow: `0 0 14px ${accent}`,
            }}
          />
        </div>
      )}

      <h2
        style={{
          margin: "2px 0 0",
          fontFamily: monoHeading ? theme.fontMono : theme.fontDisplay,
          fontSize: headingSize,
          fontWeight: 700,
          color: monoHeading ? theme.brand300 : theme.fg1,
          letterSpacing: -0.02 * headingSize,
          lineHeight: 1.06,
          ...headingMot,
        }}
      >
        {heading}
      </h2>

      {subtitle && (
        <p
          style={{
            margin: "6px 0 0",
            maxWidth: subtitleMaxWidth,
            fontFamily: theme.fontBody,
            fontSize: 20,
            fontWeight: 500,
            color: theme.fg3,
            lineHeight: 1.4,
            letterSpacing: -0.005 * 20,
            ...subtitleMot,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
