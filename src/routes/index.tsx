import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
import { formatDateDisplay, getDayName } from "~/services/date-utils";
import type { DayData } from "~/services/types";

export const useTodayData = routeLoader$<DayData | null>(
  async ({ cookie, env }) => {
    const accessToken = cookie.get("access_token")?.value;
    if (!accessToken) return null;

    try {
      const { getTodayData } = await import("~/services/sheets");
      return await getTodayData(accessToken, env);
    } catch (e) {
      console.error("Failed to load today data:", e);
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

export const useQuickReserve = routeAction$(async (_data, { cookie, env }) => {
  const accessToken = cookie.get("access_token")?.value;
  const userName = cookie.get("user_name")?.value;
  if (!accessToken || !userName)
    return { success: false, error: "Not authenticated" };

  try {
    const { getTodayData, updateSpot } = await import("~/services/sheets");
    const todayData = await getTodayData(accessToken, env);
    if (!todayData) return { success: false, error: "No data for today" };

    const freeSpot = todayData.spots.find(
      (s: { isDivider: boolean; occupant: string }) =>
        !s.isDivider && !s.occupant,
    );
    if (!freeSpot) return { success: false, error: "No spots available" };

    // Pass empty string as expectedValue since the spot should be free
    await updateSpot(
      accessToken,
      env,
      todayData.rowIndex,
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
});

export default component$(() => {
  const todayData = useTodayData();
  const reserveAction = useReserveSpot();
  const quickReserveAction = useQuickReserve();

  const today = new Date();
  const dateStr = formatDateDisplay(today);
  const dayName = getDayName(today);

  const data = todayData.value;
  const spots = data?.spots.filter((s) => !s.isDivider) || [];
  const freeCount = spots.filter((s) => !s.occupant).length;

  if (!data) {
    return (
      <div class="container">
        <div class="today-header">
          <h1>Today</h1>
          <p class="date-display">
            {dayName}, {dateStr}
          </p>
        </div>
        <div class="card">
          <p class="text-center" style="margin-bottom: 0.75rem;">
            NiCE Parking is an internal tool for the Prague office which allows
            employees to view and reserve available parking spaces for the day.
            Sign in with your Google account to get started. When you log in,
            please <b>allow access to Google Spreadsheets</b>.
          </p>
          <p class="text-center">
            <a href="/api/auth" class="btn btn-primary">
              Sign in with Google
            </a>
          </p>
          <p
            class="text-center text-muted"
            style="margin-top: 1rem; font-size: 0.8125rem;"
          >
            By signing in you agree to our <a href="/privacy">Privacy Policy</a>{" "}
            and <a href="/terms">Terms of Service</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div class="today-header">
        <div class="stats">
          <span class="stat-badge">
            {freeCount} / {spots.length} spots free
          </span>
        </div>
        <h1>Today</h1>
        <p class="date-display">
          {dayName}, {dateStr}
        </p>
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
  title: "NiCE Prague Parking",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for today",
    },
  ],
};
