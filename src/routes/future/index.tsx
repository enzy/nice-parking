import { component$, useComputed$, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  server$,
  type DocumentHead,
  Link,
} from "@builder.io/qwik-city";
import { PollStatus } from "~/components/poll-status/poll-status";
import {
  useDayListPollingSignals,
  createGlowTimer,
  pollDayList,
  setupPolling,
} from "~/hooks/use-polling";
import type { DayData } from "~/services/types";

export const useUpcomingDays = routeLoader$<DayData[]>(
  async ({ cookie, env }) => {
    const accessToken = cookie.get("access_token")?.value;
    if (!accessToken) return [];

    try {
      const { getUpcomingDays } = await import("~/services/sheets");
      return await getUpcomingDays(accessToken, env, 15);
    } catch (e) {
      console.error("Failed to load upcoming days:", e);
      return [];
    }
  },
);

const fetchUpcomingDays = server$(async function (): Promise<DayData[]> {
  const accessToken = this.cookie.get("access_token")?.value;
  if (!accessToken) return [];

  try {
    const { getUpcomingDays } = await import("~/services/sheets");
    return await getUpcomingDays(accessToken, this.env, 15);
  } catch (e) {
    console.error("Failed to poll upcoming days:", e);
    return [];
  }
});

export default component$(() => {
  const upcoming = useUpcomingDays();

  const { polledDays, lastUpdated, changedDates, secondsAgo } =
    useDayListPollingSignals();

  const days = useComputed$(() => polledDays.value ?? upcoming.value);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!upcoming.value || upcoming.value.length === 0) return;

    polledDays.value = upcoming.value;
    lastUpdated.value = Date.now();

    const glowTimer = createGlowTimer();

    const doPoll = async () => {
      try {
        await pollDayList(
          fetchUpcomingDays,
          { polledDays, lastUpdated, changedDates },
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

  if (days.value.length === 0) {
    return (
      <div class="container">
        <h1>Upcoming Days</h1>
        <div class="card">
          <p class="text-center text-muted">
            Please sign in with Google to view upcoming parking availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <h1>Upcoming Days</h1>
      <p class="subtitle">Next 14 days parking availability</p>

      <div class="days-list">
        {days.value.map((dayData, i) => {
          const spots = dayData.spots.filter((s) => !s.isDivider);
          const freeCount = spots.filter((s) => !s.occupant).length;
          const totalSpots = spots.length;
          const dateEncoded = encodeURIComponent(dayData.date);
          const isToday = i === 0;
          const isChanged = changedDates.value.includes(dayData.date);

          return (
            <Link
              key={dayData.date}
              href={isToday ? "/" : `/day/${dateEncoded}`}
              class={`day-row ${freeCount === 0 ? "day-full" : ""} ${isToday ? "day-today" : ""} ${isChanged ? "day-row-changed" : ""}`}
            >
              <div class="day-info">
                <span class="day-date">{dayData.date}</span>
                <span class="day-name">{dayData.day}</span>
              </div>
              <div class="day-availability">
                <span
                  class={`availability-badge ${freeCount === 0 ? "badge-full" : freeCount <= 3 ? "badge-low" : "badge-available"}`}
                >
                  {freeCount} / {totalSpots} free
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <PollStatus lastUpdated={lastUpdated} secondsAgo={secondsAgo} />
    </div>
  );
});

export const head: DocumentHead = {
  title: "NiCE Prague Parking - Upcoming",
  meta: [
    {
      name: "description",
      content: "View parking availability for upcoming days",
    },
  ],
};
