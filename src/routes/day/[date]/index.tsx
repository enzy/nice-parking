import {
  component$,
  useComputed$,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import {
  routeLoader$,
  server$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { PollStatus } from "~/components/poll-status/poll-status";
import { SpotsGrid } from "~/components/spots-grid/spots-grid";
import {
  useSpotPollingSignals,
  createGlowTimer,
  pollSpots,
  setupPolling,
  optimisticUpdateSpot,
} from "~/hooks/use-polling";
import type { DayData } from "~/services/types";
import type { ReserveResult } from "~/services/spot-actions";

import { useSession } from "../../layout";

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

const fetchDayData = server$(async function (
  dateStr: string,
): Promise<DayData | null> {
  const accessToken = this.cookie.get("access_token")?.value;
  if (!accessToken) return null;

  try {
    const { getDayData } = await import("~/services/sheets");
    return await getDayData(accessToken, this.env, dateStr);
  } catch (e) {
    console.error("Failed to poll day data:", e);
    return null;
  }
});

const serverReserveSpot = server$(async function (
  rowIndex: number,
  colIndex: number,
  value: string,
  expectedValue: string,
): Promise<ReserveResult> {
  const accessToken = this.cookie.get("access_token")?.value;
  if (!accessToken) return { success: false, error: "Not authenticated" };

  const { reserveSpot } = await import("~/services/spot-actions");
  return reserveSpot(
    accessToken,
    this.env,
    rowIndex,
    colIndex,
    value,
    expectedValue,
  );
});

const serverQuickReserve = server$(async function (
  dateStr: string,
): Promise<ReserveResult> {
  const accessToken = this.cookie.get("access_token")?.value;
  const userName = this.cookie.get("user_name")?.value;
  if (!accessToken || !userName)
    return { success: false, error: "Not authenticated" };

  const { quickReserveSpot } = await import("~/services/spot-actions");
  const { getDayData } = await import("~/services/sheets");
  return quickReserveSpot(
    accessToken,
    this.env,
    decodeURIComponent(userName),
    () => getDayData(accessToken, this.env, dateStr),
  );
});

export default component$(() => {
  const dayData = useDayData();
  const session = useSession();

  const {
    polledData,
    lastUpdated,
    changedSpots,
    editingSpot,
    editValue,
    secondsAgo,
  } = useSpotPollingSignals();

  const data = useComputed$(() => polledData.value ?? dayData.value);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!dayData.value) return;

    polledData.value = dayData.value;
    lastUpdated.value = Date.now();

    const dateStr = dayData.value.date;
    const glowTimer = createGlowTimer();

    const doPoll = async () => {
      try {
        await pollSpots(
          () => fetchDayData(dateStr),
          { polledData, lastUpdated, changedSpots, editingSpot },
          glowTimer,
        );
      } catch (e) {
        console.error("Poll error:", e);
      }
    };

    setupPolling(lastUpdated, secondsAgo, doPoll, cleanup, () => {
      clearTimeout(glowTimer.current);
    });
  });

  const spots = useComputed$(
    () => data.value?.spots.filter((s) => !s.isDivider) || [],
  );
  const freeCount = useComputed$(
    () => spots.value.filter((s) => !s.occupant).length,
  );

  // Quick reserve state
  const quickReserveResult = useSignal<ReserveResult | null>(null);
  const quickReserveRunning = useSignal(false);

  // Reserve (manual edit) state
  const reserveResult = useSignal<ReserveResult | null>(null);

  if (!data.value) {
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

  return (
    <div class="container">
      <div class="today-header">
        <div class="stats">
          <span class="stat-badge">
            {freeCount.value} / {spots.value.length} spots free
          </span>
        </div>
        <h1>{data.value.day}</h1>
        <p class="date-display">{data.value.date}</p>
      </div>

      <div class="actions-bar">
        <button
          type="button"
          class="btn btn-primary"
          disabled={freeCount.value === 0 || quickReserveRunning.value}
          onClick$={async () => {
            quickReserveResult.value = null;
            quickReserveRunning.value = true;

            // Optimistic: find first free spot and mark it as taken
            const freeSpot = polledData.value?.spots.find(
              (s) => !s.isDivider && !s.occupant,
            );
            let rollback: (() => void) | undefined;
            if (freeSpot) {
              rollback = optimisticUpdateSpot(
                polledData,
                freeSpot.colIndex,
                session.value.name,
              );
            }

            const result = await serverQuickReserve(data.value?.date ?? "");
            quickReserveResult.value = result;
            quickReserveRunning.value = false;

            if (!result.success && rollback) {
              rollback();
            }
          }}
        >
          Quick Reserve
        </button>
        {quickReserveResult.value?.success && (
          <span class="success-msg">
            Reserved {quickReserveResult.value.spotName}!
          </span>
        )}
        {quickReserveResult.value && !quickReserveResult.value.success && (
          <span class="error-msg">{quickReserveResult.value.error}</span>
        )}
      </div>

      <SpotsGrid
        spots={data.value.spots}
        rowIndex={data.value.rowIndex}
        polledData={polledData}
        changedSpots={changedSpots}
        editingSpot={editingSpot}
        editValue={editValue}
        reserveResult={reserveResult}
        onSave$={async (rowIndex, colIndex, value, expectedValue) => {
          const rollback = optimisticUpdateSpot(polledData, colIndex, value);

          const result = await serverReserveSpot(
            rowIndex,
            colIndex,
            value,
            expectedValue,
          );
          reserveResult.value = result;

          if (!result.success) {
            rollback();
          }
        }}
      />

      <PollStatus lastUpdated={lastUpdated} secondsAgo={secondsAgo} />
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
