import React from "react";
import { theme } from "../theme";

interface Props {
  children: React.ReactNode;
  /** Override hover-fill colour intensity 0..1 (used when cursor parks on it). */
  hoverProgress?: number;
  size?: number;
}

/**
 * Mirrors `.icon-btn` from app.css — 28x28 square, 10px radius,
 * surface-2 fill, fg-2 icon, surface-3 + fg-1 on hover.
 */
export const IconButton: React.FC<Props> = ({ children, hoverProgress = 0, size = 28 }) => {
  const bg = hoverProgress > 0
    ? `rgba(255,255,255,${0.06 + 0.04 * hoverProgress})` // surface-2 → surface-3
    : theme.surface2;
  const color = hoverProgress > 0.5 ? theme.fg1 : theme.fg2;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: theme.radiusSm,
        background: bg,
        border: `1px solid ${theme.border}`,
        color,
      }}
    >
      {children}
    </span>
  );
};

export const ExplorerIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const DotsIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18" cy="12" r="1.2" />
  </svg>
);
