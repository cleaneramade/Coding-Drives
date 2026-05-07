import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, motion } from "./theme";
import { Stage } from "./components/Stage";
import { BrandMark } from "./components/BrandMark";
import { Caption } from "./components/Caption";
import { ProjectCard, ProjectCardData } from "./components/ProjectCard";
import { Cursor } from "./components/Cursor";
import { VendorRoll } from "./components/VendorRoll";
import { AddProjectModal } from "./components/AddProjectModal";
import { CardMenuPopover } from "./components/CardMenuPopover";

// ── Layout ─────────────────────────────────────────────────────────────
// Centred flex column: caption slot → middle slot (modal OR card) → toast
// slot. Slot heights below drive the canvas Y of the card / modal so the
// cursor coords land on real button centres.
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const CAPTION_SLOT_H = 180;
const MIDDLE_SLOT_H = 270;        // fits both the modal (~230 tall) and the card (~222)
const TOAST_SLOT_H = 110;
const STACK_GAP = 36;

const STACK_TOTAL =
  CAPTION_SLOT_H + STACK_GAP + MIDDLE_SLOT_H + STACK_GAP + TOAST_SLOT_H;
const STACK_TOP = (CANVAS_H - STACK_TOTAL) / 2;            // 224
const MIDDLE_TOP = STACK_TOP + CAPTION_SLOT_H + STACK_GAP; // 440

// Card geometry (mirrors ProjectCard.tsx so cursor lands on real centres).
const CARD_W = 580;
const CARD_X = (CANVAS_W - CARD_W) / 2;                    // 670
const CARD_Y = MIDDLE_TOP + (MIDDLE_SLOT_H - 222) / 2;     // 464
const CARD_INNER_LEFT = CARD_X + 20;
const CARD_INNER_W = CARD_W - 40;
const VENDOR_BTN_W = (CARD_INNER_W - 16) / 3;
const VENDOR_ROW_Y = CARD_Y + 18 + 54 + 14 + 22 + 14 + 30 + 14 + 19;
const VENDOR_X: [number, number, number] = [
  CARD_INNER_LEFT + 0 * (VENDOR_BTN_W + 8) + VENDOR_BTN_W / 2,
  CARD_INNER_LEFT + 1 * (VENDOR_BTN_W + 8) + VENDOR_BTN_W / 2,
  CARD_INNER_LEFT + 2 * (VENDOR_BTN_W + 8) + VENDOR_BTN_W / 2,
];
const STATUS_X = CARD_INNER_LEFT + 56 + 10 + 80 + 4 + 64 + 4 + 86 / 2;
const STATUS_Y = CARD_Y + 18 + 54 + 14 + 11;
const DOTS_X = CARD_X + CARD_W - 20 - 14;
const DOTS_Y = CARD_Y + 18 + 14;

// Modal geometry — modal is 540 wide, ~230 tall; sits centred in the
// middle slot. Submit-button centre is what the cursor needs to land on.
const MODAL_W = 540;
const MODAL_H = 230;
const MODAL_X = (CANVAS_W - MODAL_W) / 2;                  // 690
const MODAL_Y = MIDDLE_TOP + (MIDDLE_SLOT_H - MODAL_H) / 2; // 460
// Submit (Add Project) centre: footer is the bottom 70px of the modal.
const SUBMIT_X = MODAL_X + MODAL_W - 20 - 54;              // 1156 — right-aligned button
const SUBMIT_Y = MODAL_Y + MODAL_H - 20 - 19;              // 652 — footer button centre

// Popover geometry — top-right anchored to the dots-menu icon, sits just
// below it. Width 220, ~150 tall (4 menu rows + 6px padding × 2).
const POP_W = 220;
const POP_X = DOTS_X + 14 - POP_W;                         // right edge aligned to dots icon
const POP_Y = DOTS_Y + 22;                                 // just below dots icon
// "Backup now" is the first row inside the popover.
const POP_BACKUP_X = POP_X + POP_W / 2;
const POP_BACKUP_Y = POP_Y + 6 + 18;                       // padding + half row

// ── Single demo card — uses real folder name from the user's tracker ────
const BASE_CARD: ProjectCardData = {
  name: "Lunar Leads",
  status: "in-progress",
  stack: { label: "Next.js", tint: "slate" },
  indicators: ["git", "claude", "env"],
  path: "C:\\Users\\…\\Lunar Leads",
};

// ── Demo composition ─────────────────────────────────────────────────────
//
// Five beats over 20 seconds. No brand intro — we open cold on the
// Add Project modal so the viewer immediately sees what the app does.
//
//   1. Add a project          0–150   (5.0s) — modal → click submit → card
//   2. Open in [VENDOR]       150–305 (5.2s) — vendor roll, cursor cycles
//   3. Update status          300–380 (2.7s) — status morph
//   4. Backup with menu       380–525 (4.8s) — dots → popover → Backup → toast
//   5. Outro                  530–600 (2.3s) — logo + GitHub URL
// ────────────────────────────────────────────────────────────────────────
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Composition-wide ambient drift — barely perceptible.
  const ambX = Math.sin(frame / 38) * 1.5;
  const ambY = Math.cos(frame / 50) * 1.0;

  // Initial canvas fade-in from black so the demo doesn't snap on at frame 0.
  const stageOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
    easing: motion.ease.out,
  });

  // ── Scene 1: Modal materialises ───────────────────────────────────
  // Modal exit extended (95→135) so it overlaps with the card entrance
  // (105→150). 30 frames of overlap = smoother handoff than v10's 15.
  const modalEnterSp = spring({ frame, fps, config: motion.springSlow });
  const modalEnterScale = interpolate(modalEnterSp, [0, 1], [0.92, 1]);
  const modalExitScale = interpolate(frame, [95, 135], [1, 0.93], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.smooth,
  });
  const modalScale = modalEnterScale * modalExitScale;
  const modalOpacity = Math.min(
    interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp", easing: motion.ease.out }),
    interpolate(frame, [95, 135], [1, 0], { extrapolateLeft: "clamp", easing: motion.ease.smooth }),
  );
  // Submit-button highlight: brightens as the cursor parks on it.
  const submitHover = interpolate(frame, [55, 75, 92, 102], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Card lifecycle ───────────────────────────────────────────────
  // Card entry extended (105→150) for a 30-frame overlap with modal exit.
  const cardOpacity = interpolate(frame, [105, 150, 525, 540], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const materialiseSp = spring({
    frame: frame - 105,
    fps,
    config: { mass: 0.8, damping: 16, stiffness: 110 },
  });
  const cardScale = interpolate(materialiseSp, [0, 1], [0.7, 1]);

  // ── Vendor cycle (scene 2 of the demo, frames 150–305) ───────────
  // Smoother bezier + 25-frame transitions (was 17/15) so the roll
  // feels like a continuous slide rather than a series of snaps.
  const vendorIdx = interpolate(
    frame,
    [170, 200, 225, 250, 270, 290],
    [0, 0, 1, 1, 2, 2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: motion.ease.smooth },
  );
  const sceneHover =
    frame >= 165 && frame <= 295
      ? {
          vscode: Math.max(0, 1 - Math.abs(vendorIdx - 0)),
          claude: Math.max(0, 1 - Math.abs(vendorIdx - 1)),
          codex:  Math.max(0, 1 - Math.abs(vendorIdx - 2)),
        }
      : {};
  const vendorRollOpacity = Math.min(
    interpolate(frame, [150, 170], [0, 1], { extrapolateRight: "clamp", easing: motion.ease.out }),
    interpolate(frame, [290, 305], [1, 0], { extrapolateLeft: "clamp", easing: motion.ease.in }),
  );

  // ── Status morph (scene 3, frames 300–380) ───────────────────────
  const showMorph = frame >= 320;
  const statusMorph = interpolate(frame, [325, 355], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.inOut,
  });

  // ── Backup beat (scene 4, frames 380–525) ────────────────────────
  // Popover opens after the cursor presses dots at ~405; "Backup now"
  // gets a hover highlight as the cursor approaches; press at ~440 fires
  // the popover-exit + toast-enter.
  const popoverOpacity = Math.min(
    interpolate(frame, [400, 420], [0, 1], { extrapolateRight: "clamp", easing: motion.ease.out }),
    interpolate(frame, [445, 465], [1, 0], { extrapolateLeft: "clamp", easing: motion.ease.in }),
  );
  const popoverEnterScale = interpolate(frame, [400, 420], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.out,
  });
  const popoverExitScale = interpolate(frame, [445, 465], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.in,
  });
  const popoverScale = popoverEnterScale * popoverExitScale;
  const backupHover = interpolate(frame, [425, 437, 445, 460], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Backup toast — slides up after the popover's "Backup now" press.
  const toastSp = spring({ frame: frame - 450, fps, config: motion.springSlow });
  const toastEnter = toastSp;
  const toastExit = interpolate(frame, [515, 530], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.in,
  });
  const toastOpacity = Math.min(toastEnter, toastExit);
  const toastTy = interpolate(toastSp, [0, 1], [40, 0]);

  // After backup completes, the card's lastBackup pill updates to "Just now".
  const showBackedUp = frame >= 458;

  // ── Cursor pathing — visible scenes 1–4 ─────────────────────────
  // Single keyframe array mirrored to two interpolate calls keeps the
  // cursor moving in a continuous arc across the full timeline.
  const cursorXFs = [0, 25, 60, 95, 115, 170, 207, 252, 290, 305, 320, 360, 380, 395, 415, 430, 525];
  const cursorXVs = [
    -50,
    700,                   // approach modal area
    SUBMIT_X,              // Add Project submit button
    SUBMIT_X,              // press
    960,                   // drift to centre after modal
    VENDOR_X[0],
    VENDOR_X[1],
    VENDOR_X[2],
    VENDOR_X[2],
    VENDOR_X[2],           // hold while caption swaps
    STATUS_X,              // status pill
    STATUS_X,
    STATUS_X,              // hold post-status
    DOTS_X,                // dots menu
    DOTS_X,                // press dots
    POP_BACKUP_X,          // Backup now item
    POP_BACKUP_X,          // hold
  ];
  const cursorYFs = [0, 25, 60, 95, 115, 170, 290, 305, 320, 360, 380, 395, 415, 430, 525];
  const cursorYVs = [
    -50,
    600,
    SUBMIT_Y,
    SUBMIT_Y,
    600,
    VENDOR_ROW_Y,
    VENDOR_ROW_Y,
    590,                   // drift toward status
    STATUS_Y,
    STATUS_Y,
    STATUS_Y,
    DOTS_Y,
    DOTS_Y,
    POP_BACKUP_Y,
    POP_BACKUP_Y,
  ];
  // Smoother bezier on cursor motion — the gentler ease-in-out reads as
  // intention rather than scripted keyframe-hopping.
  const cursorX = interpolate(frame, cursorXFs, cursorXVs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.smooth,
  });
  const cursorY = interpolate(frame, cursorYFs, cursorYVs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.ease.smooth,
  });
  const cursorOpacity = Math.min(
    interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp", easing: motion.ease.out }),
    interpolate(frame, [528, 545], [1, 0], { extrapolateLeft: "clamp", easing: motion.ease.in }),
  );
  const pressed =
    (frame >= 92 && frame <= 102)   ||  // Add Project submit
    (frame >= 322 && frame <= 332)  ||  // Status pill
    (frame >= 402 && frame <= 412)  ||  // Dots menu
    (frame >= 437 && frame <= 447);     // Backup now

  // ── Scene-edge sweeps ────────────────────────────────────────────
  // Wider window (24 frames vs 14) so the wash builds and recedes more
  // gradually. Smoother bezier ramp instead of a triangular peak.
  const SCENE_EDGES = [150, 305, 380, 530];
  let sweepIntensity = 0;
  for (const t of SCENE_EDGES) {
    const dist = Math.abs(frame - t);
    if (dist < 24) {
      const linear = 1 - dist / 24;
      // Smooth bell curve: linear^2 * (3 - 2*linear) — Hermite smoothstep
      const smooth = linear * linear * (3 - 2 * linear);
      sweepIntensity = Math.max(sweepIntensity, smooth);
    }
  }

  // ── Composition middle visibility ────────────────────────────────
  const middleVisible =
    cardOpacity > 0 || modalOpacity > 0 || vendorRollOpacity > 0 || toastOpacity > 0;

  // Caption + card fade for outro takeover.
  const cardData: ProjectCardData = {
    ...BASE_CARD,
    ...(showMorph ? { morphTo: "done" as const } : {}),
    ...(showBackedUp ? { lastBackup: "Just now" } : {}),
  };

  return (
    <AbsoluteFill style={{ opacity: stageOpacity }}>
      <Stage driftX={ambX} driftY={ambY}>
        {/* Centred flex column — caption slot, middle slot, toast slot */}
        {middleVisible && (
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: STACK_GAP,
            }}
          >
            {/* Caption slot */}
            <div
              style={{
                position: "relative",
                width: 1200,
                height: CAPTION_SLOT_H,
                transform: `translate(${ambX * 0.4}px, ${ambY * 0.4}px)`,
              }}
            >
              <Caption
                startFrame={5}
                endFrame={145}
                eyebrow="Add a project"
                heading="Drop in any folder."
                subtitle="We auto-detect your stack."
                headingSize={64}
              />
              <Caption
                startFrame={295}
                endFrame={380}
                eyebrow="Update status"
                heading="One click."
                subtitle="The tracker stays in sync."
                headingSize={64}
              />
              <Caption
                startFrame={380}
                endFrame={525}
                eyebrow="Backup"
                heading="Backup, one click."
                subtitle="To a folder you choose."
                headingSize={64}
              />
              {vendorRollOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <VendorRoll index={vendorIdx} size={72} opacity={vendorRollOpacity} />
                </div>
              )}
            </div>

            {/* Middle slot — modal OR card, mutually exclusive in time */}
            <div
              style={{
                position: "relative",
                width: 600,
                height: MIDDLE_SLOT_H,
                transform: `translate(${ambX * 0.4}px, ${ambY * 0.4}px)`,
              }}
            >
              {modalOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AddProjectModal opacity={modalOpacity} scale={modalScale} submitHover={submitHover} />
                </div>
              )}
              {cardOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: CARD_W,
                      opacity: cardOpacity,
                      transform: `scale(${cardScale})`,
                      transformOrigin: "center center",
                    }}
                  >
                    <CardGlowHalo frame={frame} />
                    <ProjectCard
                      data={cardData}
                      statusMorph={showMorph ? statusMorph : 0}
                      hoverProgress={sceneHover}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Toast slot */}
            <div
              style={{
                position: "relative",
                width: 540,
                height: TOAST_SLOT_H,
                transform: `translate(${ambX * 0.4}px, ${ambY * 0.4}px)`,
              }}
            >
              {toastOpacity > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BackupToast translateY={toastTy} opacity={toastOpacity} />
                </div>
              )}
            </div>
          </AbsoluteFill>
        )}

        {/* Popover — absolute canvas positioning, anchored to the dots
            icon's right edge. Renders on top of the card. */}
        {popoverOpacity > 0 && (
          <CardMenuPopover
            x={POP_X}
            y={POP_Y}
            scale={popoverScale}
            opacity={popoverOpacity}
            backupHover={backupHover}
          />
        )}

        {/* Cursor — canvas-coord, on top of everything */}
        {cursorOpacity > 0 && (
          <Cursor x={cursorX + ambX} y={cursorY + ambY} opacity={cursorOpacity} pressed={pressed} />
        )}

        {/* Outro */}
        <SceneOutro frame={frame} fps={fps} />

        {/* Scene-edge sweeps */}
        {sweepIntensity > 0.001 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(106,77,255,0.22), transparent 70%)",
              opacity: sweepIntensity * 0.7,
              pointerEvents: "none",
            }}
          />
        )}
      </Stage>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Card glow halo
// ─────────────────────────────────────────────────────────────────────────
const CardGlowHalo: React.FC<{ frame: number }> = ({ frame }) => {
  const intensity = interpolate(frame, [110, 145, 165, 540], [0, 1, 0.35, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (intensity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: -80,
        borderRadius: 36,
        background:
          "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(106,77,255,0.45), rgba(106,77,255,0) 70%)",
        opacity: intensity,
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Backup toast — inline-rendered (no canvas-anchored absolute), parent
// slot in Demo.tsx handles centring.
// ─────────────────────────────────────────────────────────────────────────
const BackupToast: React.FC<{ translateY: number; opacity: number }> = ({ translateY, opacity }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "44px 1fr",
      gap: 16,
      alignItems: "center",
      padding: "16px 24px 16px 18px",
      minWidth: 380,
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderLeft: `4px solid ${theme.success}`,
      borderRadius: 14,
      boxShadow: `0 22px 50px -18px rgba(0,0,0,0.55), 0 12px 28px -16px ${theme.success}40`,
      backdropFilter: "blur(20px)",
      transform: `translateY(${translateY}px)`,
      opacity,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: theme.successSoft,
        color: theme.success,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          fontFamily: theme.fontBody,
          fontSize: 16,
          fontWeight: 700,
          color: theme.fg1,
          letterSpacing: -0.005 * 16,
        }}
      >
        Backed up just now
      </span>
      <span
        style={{
          fontFamily: theme.fontMono,
          fontSize: 12,
          fontWeight: 500,
          color: theme.fg3,
          letterSpacing: 0,
        }}
      >
        C:\Coding Drives Backups\Lunar Leads
      </span>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Outro — only scene with the brand mark + GitHub URL.
// ─────────────────────────────────────────────────────────────────────────
const SceneOutro: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  if (frame < 530) return null;

  const logoSp = spring({ frame: frame - 535, fps, config: motion.springSlow });
  const logoScale = interpolate(logoSp, [0, 1], [0.85, 1]);
  const wordSp = spring({ frame: frame - 548, fps, config: motion.springFast });
  const wordY = interpolate(wordSp, [0, 1], [16, 0]);
  const tagSp = spring({ frame: frame - 558, fps, config: motion.springFast });
  const tagY = interpolate(tagSp, [0, 1], [12, 0]);
  const urlSp = spring({ frame: frame - 568, fps, config: motion.springFast });
  const urlY = interpolate(urlSp, [0, 1], [10, 0]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ opacity: logoSp, transform: `scale(${logoScale})` }}>
          <BrandMark size={150} />
        </div>
        <div
          style={{
            opacity: wordSp,
            transform: `translateY(${wordY}px)`,
            fontFamily: theme.fontDisplay,
            fontSize: 72,
            fontWeight: 700,
            color: theme.fg1,
            letterSpacing: -0.02 * 72,
            lineHeight: 1,
          }}
        >
          Coding Drives
        </div>
        <div
          style={{
            opacity: tagSp,
            transform: `translateY(${tagY}px)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: theme.fontBody,
            fontSize: 16,
            fontWeight: 500,
            color: theme.fg2,
            letterSpacing: 0.16 * 16,
            textTransform: "uppercase",
          }}
        >
          <span>Open source</span>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: theme.brand400 }} />
          <span>MIT</span>
        </div>
        <div
          style={{
            opacity: urlSp,
            transform: `translateY(${urlY}px)`,
            fontFamily: theme.fontMono,
            fontSize: 22,
            fontWeight: 500,
            color: theme.brand300,
          }}
        >
          github.com/cleaneramade/coding-drives
        </div>
      </div>
    </AbsoluteFill>
  );
};
