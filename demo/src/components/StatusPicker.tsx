import React from "react";
import { StatusPill, StatusKind } from "./StatusPill";

const ORDER: StatusKind[] = ["in-progress", "on-hold", "done", "archived"];

interface Props {
  /** Currently selected status. */
  selected: StatusKind;
  /** Optional second status to cross-fade into (used during a "click" morph). */
  morphTo?: StatusKind;
  /** 0..1 cross-fade progress between selected and morphTo. */
  morph?: number;
}

/**
 * The four-pill picker that sits next to the "Status" label on each card,
 * matching the live app's .status-picker. Renders all four labels; the
 * "selected" pill shows the filled treatment.
 *
 * For the click-morph effect, the OLD selected pill stacks both visual
 * states in the same slot and fades them; same for the NEW pill. Other
 * pills render once at their static unselected state.
 */
export const StatusPicker: React.FC<Props> = ({ selected, morphTo, morph = 0 }) => {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
      {ORDER.map((kind) => {
        const isOld = kind === selected;
        const isNew = morphTo && kind === morphTo;

        // Animated slot: render both selected + unselected in the same place
        // and fade between them.
        if (morphTo && (isOld || isNew)) {
          const selectedOpacity = isOld ? 1 - morph : morph;       // OLD fades out, NEW fades in
          const unselectedOpacity = isOld ? morph : 1 - morph;     // OLD fades to neutral, NEW fades from neutral
          return (
            <span key={kind} style={{ position: "relative", display: "inline-block" }}>
              {/* Filled (selected) layer */}
              <span style={{ position: "absolute", inset: 0 }}>
                <StatusPill kind={kind} selected={true} opacity={selectedOpacity} />
              </span>
              {/* Neutral (unselected) layer — also reserves the box width */}
              <StatusPill kind={kind} selected={false} opacity={unselectedOpacity} />
            </span>
          );
        }

        // Static slot
        return <StatusPill key={kind} kind={kind} selected={isOld} />;
      })}
    </div>
  );
};
