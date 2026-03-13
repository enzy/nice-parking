import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
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
  },
);

export const useReserveSpot = routeAction$(async (data, { cookie, env }) => {
  const accessToken = cookie.get("access_token")?.value;
  if (!accessToken) return { success: false, error: "Not authenticated" };

  const rowIndex = parseInt(data.rowIndex as string, 10);
  const colIndex = parseInt(data.colIndex as string, 10);
  const value = (data.value as string) || "";
  const expectedValue = data.expectedValue as string | undefined;

  try {
    const { updateSpot } = await import("~/services/sheets");
    await updateSpot(
      accessToken,
      env,
      rowIndex,
      colIndex,
      value,
      expectedValue,
    );
    return { success: true };
  } catch (e) {
    const { ConflictError } = await import("~/services/sheets");
    if (e instanceof ConflictError) {
      return {
        success: false,
        error: "This spot has been modified by someone else. Please try again.",
        conflict: true,
      };
    }
    console.error("Failed to update spot:", e);
    return { success: false, error: "Failed to update" };
  }
});

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
        (s: { isDivider: boolean; occupant: string }) =>
          !s.isDivider && !s.occupant,
      );
      if (!freeSpot) return { success: false, error: "No spots available" };

      // Pass empty string as expectedValue since the spot should be free
      await updateSpot(
        accessToken,
        env,
        dayData.rowIndex,
        freeSpot.colIndex,
        userName,
        "",
      );
      return { success: true, spotName: freeSpot.name };
    } catch (e) {
      const { ConflictError } = await import("~/services/sheets");
      if (e instanceof ConflictError) {
        return {
          success: false,
          error: "This spot was just taken by someone else. Please try again.",
          conflict: true,
        };
      }
      console.error("Quick reserve failed:", e);
      return { success: false, error: "Failed to reserve" };
    }
  },
);

export default component$(() => {
  const dayData = useDayData();
  const reserveAction = useReserveSpot();
  const quickReserveAction = useQuickReserve();
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
        <div class="stats">
          <span class="stat-badge">
            {freeCount} / {spots.length} spots free
          </span>
        </div>
        <h1>{data.day}</h1>
        <p class="date-display">{data.date}</p>
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
        {quickReserveAction.value && !quickReserveAction.value.success && (
          <span class="error-msg">{quickReserveAction.value.error}</span>
        )}
      </div>

      <SpotsGrid
        spots={data.spots}
        rowIndex={data.rowIndex}
        reserveAction={reserveAction}
      />
    </div>
  );
});

export const head: DocumentHead = {
  title: "NiCE Prague Parking - Day Detail",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for a specific day",
    },
  ],
};
