import React from "react";
import { theme } from "../theme";

export type Vendor = "vscode" | "claude" | "codex";

const GRADIENTS: Record<Vendor, string> = {
  vscode: theme.vscodeGrad,
  claude: theme.claudeGrad,
  codex:  theme.codexGrad,
};

const SHADOWS: Record<Vendor, string> = {
  vscode: "0 6px 18px -8px rgba(0, 122, 204, 0.55)",
  claude: "0 6px 18px -8px rgba(217, 119, 87, 0.55)",
  codex:  "0 6px 18px -8px rgba(255, 255, 255, 0.40)",
};

const LABELS: Record<Vendor, string> = { vscode: "VS Code", claude: "Claude Code", codex: "Codex" };

// Each vendor's logo occupies a different fraction of its viewBox, so we
// normalise the perceived weight by sizing each one slightly differently —
// matches `.vendor-vscode .vendor-mark svg`, etc. in app.css.
const ICON_SIZE: Record<Vendor, number> = { vscode: 15, claude: 14, codex: 16 };

const VendorIcon: React.FC<{ vendor: Vendor; color: string }> = ({ vendor, color }) => {
  const size = ICON_SIZE[vendor];
  if (vendor === "vscode") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
        <path
          fill={color}
          fillRule="evenodd"
          clipRule="evenodd"
          d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.8511 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z"
        />
      </svg>
    );
  }
  if (vendor === "claude") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: "block" }}>
        <path
          clipRule="evenodd"
          fillRule="evenodd"
          d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
        />
      </svg>
    );
  }
  // Codex (ChatGPT swirl)
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: "block" }}>
      <path d="M9.20509 8.76511V6.50545C9.20509 6.31513 9.27649 6.17234 9.44293 6.0773L13.9861 3.46088C14.6046 3.10413 15.342 2.93769 16.103 2.93769C18.9573 2.93769 20.7651 5.14983 20.7651 7.50454C20.7651 7.67098 20.7651 7.86129 20.7412 8.05161L16.0316 5.2924C15.7462 5.12596 15.4607 5.12596 15.1753 5.2924L9.20509 8.76511ZM19.8135 17.5659V12.1664C19.8135 11.8333 19.6708 11.5955 19.3854 11.429L13.4152 7.95633L15.3656 6.83833C15.5321 6.74328 15.6749 6.74328 15.8413 6.83833L20.3845 9.45474C21.6928 10.216 22.5728 11.8333 22.5728 13.4031C22.5728 15.2108 21.5025 16.8758 19.8135 17.5657V17.5659ZM7.80173 12.8088L5.8513 11.6671C5.68486 11.5721 5.61346 11.4293 5.61346 11.239V6.00613C5.61346 3.46111 7.56389 1.53433 10.2042 1.53433C11.2033 1.53433 12.1307 1.86743 12.9159 2.46202L8.2301 5.17371C7.94475 5.34015 7.80195 5.57798 7.80195 5.91109V12.809L7.80173 12.8088ZM12 15.2349L9.20509 13.6651V10.3351L12 8.76534L14.7947 10.3351V13.6651L12 15.2349ZM13.7958 22.4659C12.7967 22.4659 11.8693 22.1328 11.0841 21.5382L15.7699 18.8265C16.0553 18.6601 16.198 18.4222 16.198 18.0891V11.1912L18.1723 12.3329C18.3388 12.4279 18.4102 12.5707 18.4102 12.761V17.9939C18.4102 20.5389 16.4359 22.4657 13.7958 22.4657V22.4659ZM8.15848 17.1617L3.61528 14.5452C2.30696 13.784 1.42701 12.1667 1.42701 10.5969C1.42701 8.76534 2.52115 7.12414 4.20987 6.43428V11.8574C4.20987 12.1905 4.35266 12.4284 4.63802 12.5948L10.5846 16.0436L8.63415 17.1617C8.46771 17.2567 8.32492 17.2567 8.15848 17.1617ZM7.897 21.0625C5.20919 21.0625 3.23488 19.0407 3.23488 16.5432C3.23488 16.3529 3.25875 16.1626 3.2824 15.9723L7.96817 18.6839C8.25352 18.8504 8.53911 18.8504 8.82446 18.6839L14.7947 15.2351V17.4948C14.7947 17.6851 14.7233 17.8279 14.5568 17.9229L10.0136 20.5393C9.39518 20.8961 8.6578 21.0625 7.89677 21.0625H7.897ZM13.7958 23.8929C16.6739 23.8929 19.0762 21.8474 19.6235 19.1357C22.2874 18.4459 24 15.9484 24 13.4034C24 11.7383 23.2865 10.121 22.002 8.95542C22.121 8.45588 22.1924 7.95633 22.1924 7.45702C22.1924 4.0557 19.4331 1.51045 16.2458 1.51045C15.6037 1.51045 14.9852 1.60549 14.3668 1.81968C13.2963 0.773071 11.8215 0.107086 10.2042 0.107086C7.32606 0.107086 4.92383 2.15256 4.37653 4.86425C1.7126 5.55411 0 8.05161 0 10.5966C0 12.2617 0.713506 13.879 1.99795 15.0446C1.87904 15.5441 1.80764 16.0436 1.80764 16.543C1.80764 19.9443 4.56685 22.4895 7.75421 22.4895C8.39632 22.4895 9.01478 22.3945 9.63324 22.1803C10.7035 23.2269 12.1783 23.8929 13.7958 23.8929Z" />
    </svg>
  );
};

interface Props {
  vendor: Vendor;
  /** 0..1 — animates from neutral surface (0) to full brand fill (1). */
  hoverProgress?: number;
}

/**
 * Vendor button — matches `.vendor-btn` exactly. Default state is neutral
 * (surface-2 fill, faint border, fg-1 label, white logo). Hover reveals the
 * brand gradient + matching shadow; for Codex the icon and label flip dark
 * on the white fill for legibility.
 */
export const VendorButton: React.FC<Props> = ({ vendor, hoverProgress = 0 }) => {
  // For Codex (white fill), the icon + label go DARK once the gradient is
  // mostly opaque — same threshold as the live :hover rule.
  const codexFlip = vendor === "codex" && hoverProgress > 0.5;
  const labelColor = codexFlip ? "#0a0a0a" : theme.fg1;
  const iconColor  = codexFlip ? "#0a0a0a" : "#ffffff";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "9px 10px",
        borderRadius: theme.radiusMd,
        fontFamily: theme.fontBody,
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: -0.01 * 12,
        color: labelColor,
        background: theme.surface2,
        border: `1px solid ${theme.border}`,
        overflow: "hidden",
      }}
    >
      {/* Hover-fill layer animates opacity from 0 → 1 to reveal the brand gradient. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: GRADIENTS[vendor],
          opacity: hoverProgress,
          boxShadow: hoverProgress > 0.5 ? SHADOWS[vendor] : "none",
        }}
      />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}>
        <VendorIcon vendor={vendor} color={iconColor} />
        <span>{LABELS[vendor]}</span>
      </div>
    </div>
  );
};
