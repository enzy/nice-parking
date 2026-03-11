import { component$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, Link } from "@builder.io/qwik-city";
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
  }
);

export default component$(() => {
  const upcoming = useUpcomingDays();
  const days = upcoming.value;

  if (days.length === 0) {
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
        {days.map((dayData, i) => {
          const spots = dayData.spots.filter((s) => !s.isDivider);
          const freeCount = spots.filter((s) => !s.occupant).length;
          const totalSpots = spots.length;
          const dateEncoded = encodeURIComponent(dayData.date);
          const isToday = i === 0;

          return (
            <Link
              key={dayData.date}
              href={isToday ? "/" : `/day/${dateEncoded}`}
              class={`day-row ${freeCount === 0 ? "day-full" : ""} ${isToday ? "day-today" : ""}`}
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
    </div>
  );
});

export const head: DocumentHead = {
  title: "Parking - Upcoming",
  meta: [
    {
      name: "description",
      content: "View parking availability for upcoming days",
    },
  ],
};
