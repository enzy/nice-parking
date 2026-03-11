import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  type DocumentHead,
} from "@builder.io/qwik-city";
import type { DayData } from "~/services/types";

export const useDayData = routeLoader$<DayData | null>(
  async ({ cookie, env, params }) => {
    const accessToken = cookie.get("access_token")?.value;
    if (!accessToken) return null;

    const dateStr = decodeURIComponent(params.date);
    try {
      const { getDayData } = await import("~/services/sheets");
      return await getDayData(accessToken, env, dateStr);
    } catch (e) {
      console.error("Failed to load day data:", e);
      return null;
    }
  }
);

export const useReserveSpot = routeAction$(
  async (data, { cookie, env }) => {
    const accessToken = cookie.get("access_token")?.value;
    if (!accessToken) return { success: false, error: "Not authenticated" };

    const rowIndex = parseInt(data.rowIndex as string, 10);
    const colIndex = parseInt(data.colIndex as string, 10);
    const value = (data.value as string) || "";

    try {
      const { updateSpot } = await import("~/services/sheets");
      await updateSpot(accessToken, env, rowIndex, colIndex, value);
      return { success: true };
    } catch (e) {
      console.error("Failed to update spot:", e);
      return { success: false, error: "Failed to update" };
    }
  }
);

export const useQuickReserve = routeAction$(
  async (data, { cookie, env, params }) => {
    const accessToken = cookie.get("access_token")?.value;
    const userName = cookie.get("user_name")?.value;
    if (!accessToken || !userName)
      return { success: false, error: "Not authenticated" };

    const dateStr = decodeURIComponent(params.date);
    try {
      const { getDayData, updateSpot } = await import("~/services/sheets");
      const dayData = await getDayData(accessToken, env, dateStr);
      if (!dayData) return { success: false, error: "No data for this date" };

      const freeSpot = dayData.spots.find(
        (s: { isDivider: boolean; occupant: string }) => !s.isDivider && !s.occupant
      );
      if (!freeSpot)
        return { success: false, error: "No spots available" };

      await updateSpot(
        accessToken,
        env,
        dayData.rowIndex,
        freeSpot.colIndex,
        userName
      );
      return { success: true, spotName: freeSpot.name };
    } catch (e) {
      console.error("Quick reserve failed:", e);
      return { success: false, error: "Failed to reserve" };
    }
  }
);

export default component$(() => {
  const dayData = useDayData();
  const reserveAction = useReserveSpot();
  const quickReserveAction = useQuickReserve();
  const editingSpot = useSignal<number | null>(null);
  const editValue = useSignal("");

  const data = dayData.value;

  if (!data) {
    return (
      <div class="container">
        <div class="today-header">
          <a href="/future" class="back-link">
            Back to upcoming
          </a>
          <h1>Day Detail</h1>
        </div>
        <div class="card">
          <p class="text-center text-muted">
            No data available for this date. Please sign in.
          </p>
        </div>
      </div>
    );
  }

  const spots = data.spots.filter((s) => !s.isDivider);
  const freeCount = spots.filter((s) => !s.occupant).length;

  return (
    <div class="container">
      <div class="today-header">
        <a href="/future" class="back-link">
          Back to upcoming
        </a>
        <h1>{data.day}</h1>
        <p class="date-display">{data.date}</p>
        <div class="stats">
          <span class="stat-badge">
            {freeCount} / {spots.length} spots free
          </span>
        </div>
      </div>

      <div class="actions-bar">
        <Form action={quickReserveAction}>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={freeCount === 0}
          >
            Quick Reserve
          </button>
        </Form>
        {quickReserveAction.value?.success && (
          <span class="success-msg">
            Reserved {quickReserveAction.value.spotName}!
          </span>
        )}
        {quickReserveAction.value &&
          !quickReserveAction.value.success && (
            <span class="error-msg">
              {quickReserveAction.value.error}
            </span>
          )}
      </div>

      <div class="spots-grid">
        {data.spots.map((spot) => {
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
                  action={reserveAction}
                  onSubmitCompleted$={() => {
                    editingSpot.value = null;
                  }}
                >
                  <input type="hidden" name="rowIndex" value={data.rowIndex} />
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
    </div>
  );
});

export const head: DocumentHead = {
  title: "Parking - Day Detail",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for a specific day",
    },
  ],
};
