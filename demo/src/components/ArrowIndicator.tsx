import React from "react";
import { theme } from "../theme";

interface Props {
  /** Start point in canvas coords (where the arrow "leaves" — usually below caption). */
  fromX: number;
  fromY: number;
  /** End point in canvas coords (the target to point at). Can move frame-to-frame
   *  so the arrow tip follows a moving target without re-drawing. */
  toX: number;
  toY: number;
  /** 0..1 — controls strokeDashoffset for the draw-in effect. At 1 the full
   *  path is visible. The arrowhead fades in once drawProgress > 0.85. */
  drawProgress: number;
  /** Overall opacity of the indicator. */
  opacity?: number;
  /** Accent colour. Defaults to brand violet. */
  accent?: string;
  /** How much the path bows perpendicular to the from→to direction. Positive
   *  values curve clockwise (when looking from→to). */
  curve?: number;
}

/**
 * Curved arrow indicator that visually links a caption to a UI element.
 *
 * The path is a single quadratic bezier from {fromX,fromY} to {toX,toY},
 * with a control point offset perpendicular to the line by `curve` pixels.
 * The arrowhead is drawn at the path's endpoint, oriented along the bezier
 * tangent at t=1 (which equals 2*(P2 - P1) for a quadratic bezier).
 *
 * For animation, drawProgress drives stroke-dashoffset. The endpoint can
 * change every frame and the arrow re-paths instantly — useful for
 * "follow the cursor" pointing across multiple targets in one scene.
 */
export const ArrowIndicator: React.FC<Props> = ({
  fromX,
  fromY,
  toX,
  toY,
  drawProgress,
  opacity = 1,
  accent = theme.brand400,
  curve = 60,
}) => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.max(1, Math.hypot(dx, dy));

  // Control point: midpoint offset perpendicular to from→to vector.
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const perpX = (-dy / len) * curve;
  const perpY = (dx / len) * curve;
  const cX = midX + perpX;
  const cY = midY + perpY;

  // Pull the rendered endpoint slightly back along the tangent so the
  // arrowhead glyph itself sits exactly on the target rather than past it.
  const tangentX = 2 * (toX - cX);
  const tangentY = 2 * (toY - cY);
  const tangentLen = Math.max(1, Math.hypot(tangentX, tangentY));
  const inset = 12; // px to inset the line endpoint from the target
  const endX = toX - (tangentX / tangentLen) * inset;
  const endY = toY - (tangentY / tangentLen) * inset;

  // Approximate the bezier arc length for stroke-dasharray. For a quadratic
  // bezier with low curvature the chord + 2*(chord-of-half) gives a useful
  // estimate; flat-line + small curve correction is enough for our use.
  const chord = Math.hypot(endX - fromX, endY - fromY);
  const approxLen = chord + Math.abs(curve) * 0.6;

  // Arrowhead: a small triangle sitting at toX,toY, oriented along the
  // tangent. Two side points calculated by rotating the back vector ±25°.
  const angle = Math.atan2(tangentY, tangentX);
  const headLen = 16;
  const headSpread = 0.45; // radians (~26°)
  const left = {
    x: toX - headLen * Math.cos(angle - headSpread),
    y: toY - headLen * Math.sin(angle - headSpread),
  };
  const right = {
    x: toX - headLen * Math.cos(angle + headSpread),
    y: toY - headLen * Math.sin(angle + headSpread),
  };

  // Arrowhead fades in only once the line is mostly drawn.
  const headOpacity = drawProgress < 0.82 ? 0 : (drawProgress - 0.82) / 0.18;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* Soft glow under the arrow — picks up the page's brand ambient */}
      <path
        d={`M ${fromX} ${fromY} Q ${cX} ${cY} ${endX} ${endY}`}
        stroke={accent}
        strokeWidth={9}
        fill="none"
        strokeLinecap="round"
        opacity={0.18}
        strokeDasharray={approxLen}
        strokeDashoffset={approxLen * (1 - drawProgress)}
      />
      {/* Main stroke */}
      <path
        d={`M ${fromX} ${fromY} Q ${cX} ${cY} ${endX} ${endY}`}
        stroke={accent}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={approxLen}
        strokeDashoffset={approxLen * (1 - drawProgress)}
      />
      {/* Arrowhead */}
      <path
        d={`M ${left.x} ${left.y} L ${toX} ${toY} L ${right.x} ${right.y}`}
        stroke={accent}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={headOpacity}
      />
    </svg>
  );
};
