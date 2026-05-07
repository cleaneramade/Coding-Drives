import React from "react";
import { theme } from "../theme";

interface Props {
  /** 0..1 — entrance / exit fade. */
  opacity: number;
  /** Combined entrance + exit scale. */
  scale: number;
  /** 0..1 hover progress on the "Add Project" submit button (cursor parking). */
  submitHover?: number;
}

/**
 * Mirrors the live Add Project modal from `public/index.html` — header
 * with title + close X, body with help text + input row (path + Browse),
 * footer with Cancel + Add Project. Styling reads directly from app.css
 * tokens via the shared theme.
 *
 * The path field is pre-populated for the demo so the cursor can move
 * straight to the submit button. `submitHover` brightens the Add Project
 * button as the cursor parks on it for visual feedback.
 */
export const AddProjectModal: React.FC<Props> = ({ opacity, scale, submitHover = 0 }) => {
  const FOLDER_PATH = "C:\\Users\\Weedw\\Documents\\Lunar Leads";

  return (
    <div
      style={{
        width: 540,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 20,
        boxShadow:
          "0 30px 70px -22px rgba(0,0,0,0.65), 0 6px 18px -8px rgba(106,77,255,0.20), inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px 8px",
        }}
      >
        <h2
          style={{
            fontFamily: theme.fontDisplay,
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: -0.02 * 20,
            color: theme.fg1,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Add Project
        </h2>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            background: theme.surface2,
            border: `1px solid ${theme.border}`,
            color: theme.fg2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "8px 20px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p
          style={{
            color: theme.fg3,
            fontSize: 13,
            lineHeight: 1.5,
            margin: 0,
            fontFamily: theme.fontBody,
          }}
        >
          Pick a folder or paste its full path. Coding Drives will auto-detect
          the stack and indicators.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Input field — path pre-filled for the demo */}
          <div
            style={{
              flex: 1,
              padding: "10px 12px",
              fontSize: 13,
              color: theme.fg1,
              background: theme.surface2,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              fontFamily: theme.fontMono,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {FOLDER_PATH}
          </div>
          {/* Browse button (.btn-secondary in live app) */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              color: theme.fg1,
              background: theme.surface2,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              letterSpacing: -0.01 * 13,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span>Browse</span>
          </span>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          padding: "12px 20px 18px",
          borderTop: `1px solid ${theme.borderSoft}`,
        }}
      >
        {/* Cancel — .btn-ghost in live app */}
        <span
          style={{
            padding: "8px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: theme.fg2,
            letterSpacing: -0.01 * 13,
          }}
        >
          Cancel
        </span>
        {/* Add Project — .btn-brand in live app. submitHover brightens it
            and intensifies the brand glow as the cursor parks on it. */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: `linear-gradient(180deg, ${theme.brand500}, ${theme.brand600})`,
            border: "1px solid transparent",
            borderRadius: 12,
            letterSpacing: -0.01 * 13,
            filter: `brightness(${1 + submitHover * 0.12})`,
            boxShadow: `0 ${6 + submitHover * 6}px ${18 + submitHover * 12}px -8px rgba(106,77,255,${0.30 + submitHover * 0.25})`,
          }}
        >
          Add Project
        </span>
      </div>
    </div>
  );
};
