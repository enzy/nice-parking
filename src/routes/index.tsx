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
import { formatDateDisplay, getDayName } from "~/services/date-utils";
import type { DayData } from "~/services/types";
import type { ReserveResult } from "~/services/spot-actions";

import { useSession } from "./layout";

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

const fetchTodayData = server$(async function (): Promise<DayData | null> {
  const accessToken = this.cookie.get("access_token")?.value;
  if (!accessToken) return null;

  try {
    const { getTodayData } = await import("~/services/sheets");
    return await getTodayData(accessToken, this.env);
  } catch (e) {
    console.error("Failed to poll today data:", e);
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

const serverQuickReserve = server$(async function (): Promise<ReserveResult> {
  const accessToken = this.cookie.get("access_token")?.value;
  const userName = this.cookie.get("user_name")?.value;
  if (!accessToken || !userName)
    return { success: false, error: "Not authenticated" };

  const { quickReserveSpot } = await import("~/services/spot-actions");
  const { getTodayData } = await import("~/services/sheets");
  return quickReserveSpot(
    accessToken,
    this.env,
    decodeURIComponent(userName),
    () => getTodayData(accessToken, this.env),
  );
});

export default component$(() => {
  const todayData = useTodayData();
  const session = useSession();

  const today = new Date();
  const dateStr = formatDateDisplay(today);
  const dayName = getDayName(today);

  const {
    polledData,
    lastUpdated,
    changedSpots,
    editingSpot,
    editValue,
    secondsAgo,
  } = useSpotPollingSignals();

  const data = useComputed$(() => polledData.value ?? todayData.value);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!todayData.value) return;

    polledData.value = todayData.value;
    lastUpdated.value = Date.now();

    const glowTimer = createGlowTimer();

    const doPoll = async () => {
      try {
        await pollSpots(
          fetchTodayData,
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
          <h1>NiCE Prague Parking</h1>
          <p>
            NiCE Prague Parking is an internal tool for the Prague office which
            allows employees to view and reserve available parking spaces for
            the day. The app is backed by a shared Google Spreadsheet — sign in
            with your Google account to see today's availability in real time,
            claim a specific spot, or use Quick Reserve to grab the first free
            one instantly.
          </p>
        </div>
        <div class="card">
          <p class="text-center" style="margin-bottom: 0.75rem;">
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
            By signing in you agree to our{" "}
            <a href="/privacy/">Privacy Policy</a> and{" "}
            <a href="/terms/">Terms of Service</a>.
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
        <h1>Today</h1>
        <p class="date-display">
          {dayName}, {dateStr}
        </p>
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

            const result = await serverQuickReserve();
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
          // Optimistic update
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
  title: "NiCE Prague Parking",
  meta: [
    {
      name: "description",
      content: "View and reserve parking spots for today",
    },
  ],
};
