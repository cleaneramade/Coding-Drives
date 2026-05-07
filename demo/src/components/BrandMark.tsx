import React from "react";
import { Img, staticFile } from "remotion";

interface Props {
  size?: number;
  style?: React.CSSProperties;
}

// Renders the Coding Drives mascot logo (assets/logo.svg, copied into demo/public/).
export const BrandMark: React.FC<Props> = ({ size = 200, style }) => (
  <Img
    src={staticFile("logo.svg")}
    style={{
      width: size,
      height: size,
      filter: "drop-shadow(0 12px 32px rgba(106,77,255,0.45))",
      ...style,
    }}
  />
);
