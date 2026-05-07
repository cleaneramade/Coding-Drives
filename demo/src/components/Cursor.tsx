import React from "react";

interface Props {
  /** Cursor tip position (canvas coords). The hot-spot is the top-left of the SVG. */
  x: number;
  y: number;
  /** 0..1 entrance opacity. */
  opacity?: number;
  /** Slight scale-down on press for tactile feedback during a click. */
  pressed?: boolean;
  /** Pixel size — defaults to 32 (matches macOS at default zoom). */
  size?: number;
}

/**
 * macOS-style cursor — black core, white outline, soft drop-shadow. Path
 * lifted from a high-fidelity export so it reads correctly at the rendered
 * size; the small left-edge highlight adds a hint of dimensionality without
 * looking computer-generated.
 */
export const Cursor: React.FC<Props> = ({ x, y, opacity = 1, pressed = false, size = 32 }) => {
  // viewBox is 18×24; we scale it to `size` while preserving the hotspot at
  // (0,0). The wrapper is positioned so that the SVG's top-left sits exactly
  // on the (x, y) pixel — that's the actual click point.
  const w = size * (18 / 24);
  const h = size;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        pointerEvents: "none",
        zIndex: 100,
        transform: pressed ? "scale(0.93)" : "scale(1)",
        transformOrigin: "0 0",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
      }}
    >
      <svg width={w} height={h} viewBox="0 0 18 24" style={{ display: "block" }}>
        {/* White outline — drawn as both stroke and a slightly larger fill
            beneath the black core so the outline reads as a clean ring. */}
        <path
          d="M 1 1 L 1 18.5 L 5 15 L 7.6 21.5 L 10.4 20.5 L 7.8 14 L 13.5 14 Z"
          fill="#ffffff"
          stroke="#ffffff"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        {/* Black core */}
        <path
          d="M 1 1 L 1 18.5 L 5 15 L 7.6 21.5 L 10.4 20.5 L 7.8 14 L 13.5 14 Z"
          fill="#101014"
        />
        {/* Subtle highlight along the left edge — gives the arrow a hint of
            dimensionality, like specular light catches the bevel. */}
        <path
          d="M 1.6 2 L 1.6 17 L 2.4 16.3 L 2.4 2.7 Z"
          fill="rgba(255,255,255,0.18)"
        />
      </svg>
    </div>
  );
};
