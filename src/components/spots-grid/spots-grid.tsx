import { component$, useSignal, type Signal } from "@builder.io/qwik";
import { Form, type ActionStore } from "@builder.io/qwik-city";
import type { SpotData } from "~/services/types";

interface SpotsGridProps {
  spots: SpotData[];
  rowIndex: number;
  reserveAction: ActionStore<
    { success: boolean; error?: string },
    Record<string, unknown>,
    true
  >;
  editingSpot?: Signal<number | null>;
  editValue?: Signal<string>;
}

export const SpotsGrid = component$<SpotsGridProps>((props) => {
  const internalEditingSpot = useSignal<number | null>(null);
  const internalEditValue = useSignal("");

  const editingSpot = props.editingSpot ?? internalEditingSpot;
  const editValue = props.editValue ?? internalEditValue;

  return (
    <div class="spots-grid">
      {props.spots.map((spot) => {
        if (spot.isDivider) {
          return <div key={spot.colIndex} class="spot-divider" />;
        }

        const isEditing = editingSpot.value === spot.colIndex;
        const isFree = !spot.occupant;

        return (
          <div
            key={spot.colIndex}
            class={`spot-card ${isFree ? "spot-free" : "spot-taken"} ${isEditing ? "spot-editing" : ""}`}
          >
            <div class="spot-name">{spot.name}</div>

            {isEditing ? (
              <Form
                action={props.reserveAction}
                onSubmitCompleted$={() => {
                  editingSpot.value = null;
                }}
              >
                <input type="hidden" name="rowIndex" value={props.rowIndex} />
                <input type="hidden" name="colIndex" value={spot.colIndex} />
                <input
                  type="text"
                  name="value"
                  class="spot-input"
                  value={editValue.value}
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
              </Form>
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
