import React from "react";

interface Props {
  /** Outer chassis width in px. */
  width: number;
  /** Outer chassis height in px (does NOT include the floor shadow / mirror). */
  height: number;
  /** Inner screen area receives the rendered app shell. */
  children: React.ReactNode;
  /** 0..1 power-on intensity. Kept for compatibility — Demo.tsx fixes at 1. */
  power?: number;
  style?: React.CSSProperties;
}

// All-bezel monitor proportions. Studio-Display-style: thin uniform bezel
// on every side, no hinge, no keyboard. Matches the floating-monitor
// preview the user picked.
const BEZEL = 18;
const CAMERA_DOT_R = 3;

/**
 * Floating display monitor — Studio Display / LG UltraFine inspired.
 *
 * Layers (back-to-front):
 *  1. Drop shadow + faint violet glow grounding the device on the canvas
 *  2. Mirror reflection beneath the chassis (CSS box-reflect)
 *  3. Outer chassis with diagonal anodized-aluminum gradient
 *  4. Top-edge specular highlight (1px white→transparent strip)
 *  5. Inner bevel inset (subtle dark line where chassis meets screen)
 *  6. Screen surface — pure black with two soft reflection layers, hosts children
 *  7. Tiny camera dot, centred at the top of the bezel
 *
 * Each layer has a clear visual job; together they sell "real glass + metal"
 * without resorting to a PNG asset.
 */
export const DeviceFrame: React.FC<Props> = ({ width, height, children, style }) => {
  const screenW = width - BEZEL * 2;
  const screenH = height - BEZEL * 2;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        // Outer drop shadow grounds the device. Two stacked shadows: a
        // tight near-black shadow for contact, plus a soft violet bloom
        // that picks up the page's brand ambient.
        filter:
          "drop-shadow(0 50px 80px rgba(0,0,0,0.65)) drop-shadow(0 30px 60px rgba(106,77,255,0.18))",
        ...style,
      }}
    >
      {/* Outer chassis — relative wrapper that also produces the mirror
          reflection beneath it via -webkit-box-reflect. Mirror is masked
          with a sharp top-fade so it reads as a faint floor reflection
          rather than a literal duplicate of the device. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          // Diagonal chassis gradient — three stops keep the metal looking
          // anodized rather than painted. Slightly darker bottom-right
          // suggests an off-axis ambient light source.
          background:
            "linear-gradient(135deg, #1f1f24 0%, #16161b 55%, #0e0e12 100%)",
          // 1px outer ring sells the bezel edge clearly, even at small sizes.
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)",
          // Mirror reflection: a flipped copy of the chassis below it,
          // masked to fade out within the first ~12% of the reflection's
          // height. Reads as "device sitting on a glass surface" without
          // becoming literal.
          WebkitBoxReflect:
            "below 0px linear-gradient(rgba(0,0,0,0.32) 0%, transparent 14%)",
        }}
      />

      {/* Top-edge specular highlight — single most important detail for the
          chassis to read as real. Anodized aluminum picks up ambient ceiling
          light along its top edge. 1px tall, fades horizontally toward both
          ends so the centre catches the most light. */}
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: 1,
          height: 1.2,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0) 100%)",
          borderRadius: 1,
          pointerEvents: "none",
        }}
      />

      {/* Side-edge soft shadows — dark gradient just inside the left and
          right bezel inner edges. Adds depth where the bezel meets the
          screen recess. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 6,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
          borderTopLeftRadius: 20,
          borderBottomLeftRadius: 20,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 8,
          bottom: 8,
          width: 6,
          background:
            "linear-gradient(270deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          pointerEvents: "none",
        }}
      />

      {/* Bevel inset line — 1px darker line where the bezel meets the
          screen surface. Gives the screen a recessed "behind glass" feel. */}
      <div
        style={{
          position: "absolute",
          left: BEZEL - 1,
          top: BEZEL - 1,
          width: screenW + 2,
          height: screenH + 2,
          borderRadius: 6,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />

      {/* Screen surface — hosts children. Two reflection layers sit OVER the
          children but are kept very subtle (3-4% white) so they don't fight
          with the app content. */}
      <div
        style={{
          position: "absolute",
          left: BEZEL,
          top: BEZEL,
          width: screenW,
          height: screenH,
          borderRadius: 5,
          overflow: "hidden",
          background: "#000",
          // Inner shadow against the bevel line + a tiny outer bloom
          boxShadow:
            "inset 0 0 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {children}
        {/* Diagonal sheen — single faint highlight sweeping top-left to
            bottom-right. Below 4% white so app content stays the priority. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 100%)",
          }}
        />
        {/* Top-left specular — small radial highlight matching the chassis
            edge highlight. Implies "ambient ceiling light" hits the screen
            glass from the same direction as the metal bezel. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 35% 22% at 18% 0%, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
      </div>

      {/* Tiny camera dot — sits in the centre of the top bezel. 3px radius
          black circle with a hint of inner highlight for a lens feel. No
          notch cutout (this is a monitor, not a MacBook lid). */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - CAMERA_DOT_R,
          top: BEZEL / 2 - CAMERA_DOT_R,
          width: CAMERA_DOT_R * 2,
          height: CAMERA_DOT_R * 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 35%, #2a2a2f 0%, #0a0a0c 60%, #000 100%)",
          boxShadow: "inset 0 0 1.5px rgba(255,255,255,0.20)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
