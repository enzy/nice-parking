import { component$, useSignal, type Signal, type QRL } from "@builder.io/qwik";
import type { DayData, SpotData } from "~/services/types";
import type { ReserveResult } from "~/services/spot-actions";

interface SpotsGridProps {
  spots: SpotData[];
  rowIndex: number;
  polledData?: Signal<DayData | null>;
  editingSpot?: Signal<number | null>;
  editValue?: Signal<string>;
  changedSpots?: Signal<number[]>;
  reserveResult?: Signal<ReserveResult | null>;
  onSave$?: QRL<
    (
      rowIndex: number,
      colIndex: number,
      value: string,
      expectedValue: string,
    ) => Promise<void>
  >;
}

export const SpotsGrid = component$<SpotsGridProps>((props) => {
  const internalEditingSpot = useSignal<number | null>(null);
  const internalEditValue = useSignal("");

  const editingSpot = props.editingSpot ?? internalEditingSpot;
  const editValue = props.editValue ?? internalEditValue;

  const result = props.reserveResult?.value;
  const hasConflict = result && !result.success && result.conflict;

  return (
    <div class="spots-grid">
      {hasConflict && (
        <div class="conflict-banner">
          <p>{result.error}</p>
        </div>
      )}
      {props.spots.map((spot) => {
        if (spot.isDivider) {
          return <div key={spot.colIndex} class="spot-divider" />;
        }

        const isEditing = editingSpot.value === spot.colIndex;
        const isFree = !spot.occupant;
        const isChanged = (props.changedSpots?.value ?? []).includes(
          spot.colIndex,
        );

        return (
          <div
            key={spot.colIndex}
            class={`spot-card ${isFree ? "spot-free" : "spot-taken"} ${isEditing ? "spot-editing" : ""} ${isChanged ? "spot-changed" : ""}`}
          >
            <div class="spot-name">{spot.name}</div>

            {isEditing ? (
              <form
                preventdefault:submit
                onSubmit$={() => {
                  const colIndex = spot.colIndex;
                  const value = editValue.value;
                  const expectedValue = spot.occupant;
                  editingSpot.value = null;
                  props.onSave$?.(
                    props.rowIndex,
                    colIndex,
                    value,
                    expectedValue,
                  );
                }}
              >
                <input
                  type="text"
                  class="spot-input"
                  value={editValue.value}
                  onInput$={(_, el) => {
                    editValue.value = el.value;
                  }}
                  placeholder="Enter name..."
                  autoFocus
                />
                <div class="spot-actions">
                  <button type="submit" class="btn btn-small btn-primary">
                    Save
                  </button>
                  <button
                    type="button"
                    class="btn btn-small btn-outline"
                    onClick$={() => {
                      editingSpot.value = null;
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div
                class="spot-occupant"
                onClick$={() => {
                  editingSpot.value = spot.colIndex;
                  editValue.value = spot.occupant;
                }}
              >
                {isFree ? (
                  <span class="spot-available">Available</span>
                ) : (
                  <span class="spot-reserved">{spot.occupant}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
