/**
 * Shared polling utilities for setting up interval-based polling
 * with tab visibility pausing.
 *
 * These are plain functions (not hooks) that run inside useVisibleTask$
 * on the client side. They handle:
 * - 30s polling interval
 * - Pause when tab is hidden (Page Visibility API)
 * - Resume + immediate fetch when tab becomes visible
 * - Live "seconds ago" tick counter
 */

import { useSignal, type Signal } from "@builder.io/qwik";
import type { DayData } from "~/services/types";

export const POLL_INTERVAL = 30_000;

/**
 * Sets up polling with visibility pausing and a tick counter.
 * Must be called from within a useVisibleTask$ callback.
 *
 * @param lastUpdated  Signal-like object with .value (number timestamp)
 * @param secondsAgo   Signal-like object with .value (number)
 * @param doPoll       Async function that performs one poll cycle
 * @param cleanup      Qwik cleanup registration function
 * @param glowCleanup  Optional function to clear glow timers on cleanup
 */
export function setupPolling(
  lastUpdated: { value: number },
  secondsAgo: { value: number },
  doPoll: () => Promise<void>,
  cleanup: (fn: () => void) => void,
  glowCleanup?: () => void,
) {
  let pollTimer: ReturnType<typeof setInterval>;
  let tickTimer: ReturnType<typeof setInterval>;

  const startPolling = () => {
    pollTimer = setInterval(doPoll, POLL_INTERVAL);
    tickTimer = setInterval(() => {
      if (lastUpdated.value > 0) {
        secondsAgo.value = Math.floor((Date.now() - lastUpdated.value) / 1000);
      }
    }, 1000);
  };

  const stopPolling = () => {
    clearInterval(pollTimer);
    clearInterval(tickTimer);
  };

  startPolling();

  const onVisibilityChange = () => {
    if (document.hidden) {
      stopPolling();
    } else {
      doPoll(); // Fetch immediately on tab focus
      stopPolling(); // Clear any existing intervals before restarting
      startPolling();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  cleanup(() => {
    stopPolling();
    glowCleanup?.();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });
}

/**
 * Detects changed spots by comparing occupant strings between old and new DayData.
 * Returns array of colIndex values that changed.
 */
export function detectSpotChanges(
  prev: {
    spots: Array<{ isDivider: boolean; colIndex: number; occupant: string }>;
  },
  next: {
    spots: Array<{ isDivider: boolean; colIndex: number; occupant: string }>;
  },
): number[] {
  const changed: number[] = [];
  for (const newSpot of next.spots) {
    if (newSpot.isDivider) continue;
    const oldSpot = prev.spots.find((s) => s.colIndex === newSpot.colIndex);
    if (oldSpot && oldSpot.occupant !== newSpot.occupant) {
      changed.push(newSpot.colIndex);
    }
  }
  return changed;
}

/**
 * Detects changed days by comparing freeCount between old and new DayData arrays.
 * Returns array of date strings that changed.
 */
export function detectDayChanges(
  prev: Array<{
    date: string;
    spots: Array<{ isDivider: boolean; occupant: string }>;
  }>,
  next: Array<{
    date: string;
    spots: Array<{ isDivider: boolean; occupant: string }>;
  }>,
): string[] {
  const changed: string[] = [];
  for (const newDay of next) {
    const oldDay = prev.find((d) => d.date === newDay.date);
    if (oldDay) {
      const oldFree = oldDay.spots.filter(
        (s) => !s.isDivider && !s.occupant,
      ).length;
      const newFree = newDay.spots.filter(
        (s) => !s.isDivider && !s.occupant,
      ).length;
      if (oldFree !== newFree) {
        changed.push(newDay.date);
      }
    }
  }
  return changed;
}

/**
 * Applies change highlights with animation-replay support.
 * Clears the signal first, then uses requestAnimationFrame to re-set it,
 * ensuring CSS animations replay even if the same items change on consecutive polls.
 *
 * @param signal      Signal-like object with .value (array of keys)
 * @param changed     New changed keys to highlight
 * @param glowTimer   Reference object to track the glow clear timeout
 */
export function applyGlow<T>(
  signal: { value: T[] },
  changed: T[],
  glowTimer: { current: ReturnType<typeof setTimeout> | undefined },
) {
  signal.value = [];
  if (changed.length > 0) {
    clearTimeout(glowTimer.current);
    requestAnimationFrame(() => {
      signal.value = changed;
      glowTimer.current = setTimeout(() => {
        signal.value = [];
      }, 2000);
    });
  }
}

// ---------------------------------------------------------------------------
// Shared signal setup helpers
// ---------------------------------------------------------------------------

/** Glow timer reference — must be created inside useVisibleTask$ */
export type GlowTimer = {
  current: ReturnType<typeof setTimeout> | undefined;
};

export function createGlowTimer(): GlowTimer {
  return { current: undefined };
}

/**
 * Allocates the common polling signals for a single-day spot view.
 *
 * Must be called at the top level of a component$ body (not inside a
 * conditional or callback) so that Qwik can track the hooks.
 */
export function useSpotPollingSignals() {
  return {
    polledData: useSignal<DayData | null>(null),
    lastUpdated: useSignal(0),
    changedSpots: useSignal<number[]>([]),
    editingSpot: useSignal<number | null>(null),
    editValue: useSignal(""),
    secondsAgo: useSignal(0),
  };
}

/**
 * Runs one spot-polling cycle: fetches fresh data, detects changes,
 * updates signals, and applies glow highlights.
 *
 * Designed to be called from inside a useVisibleTask$ `doPoll` closure
 * where the fetch function is already in scope.
 */
export async function pollSpots(
  fetchFn: () => Promise<DayData | null>,
  signals: {
    polledData: Signal<DayData | null>;
    lastUpdated: Signal<number>;
    changedSpots: Signal<number[]>;
    editingSpot: Signal<number | null>;
  },
  glowTimer: GlowTimer,
) {
  const fresh = await fetchFn();
  if (!fresh) return;
  if (signals.editingSpot.value !== null) return;

  const prev = signals.polledData.value;
  const changed = prev ? detectSpotChanges(prev, fresh) : [];

  signals.polledData.value = fresh;
  signals.lastUpdated.value = Date.now();

  applyGlow(signals.changedSpots, changed, glowTimer);
}

/**
 * Allocates the common polling signals for the upcoming-days list view.
 *
 * Must be called at the top level of a component$ body.
 */
export function useDayListPollingSignals() {
  return {
    polledDays: useSignal<DayData[] | null>(null),
    lastUpdated: useSignal(0),
    changedDates: useSignal<string[]>([]),
    secondsAgo: useSignal(0),
  };
}

/**
 * Runs one day-list polling cycle: fetches fresh data, detects changes,
 * updates signals, and applies glow highlights.
 */
export async function pollDayList(
  fetchFn: () => Promise<DayData[]>,
  signals: {
    polledDays: Signal<DayData[] | null>;
    lastUpdated: Signal<number>;
    changedDates: Signal<string[]>;
  },
  glowTimer: GlowTimer,
) {
  const fresh = await fetchFn();
  if (!fresh || fresh.length === 0) return;

  const prev = signals.polledDays.value;
  const changed = prev ? detectDayChanges(prev, fresh) : [];

  signals.polledDays.value = fresh;
  signals.lastUpdated.value = Date.now();

  applyGlow(signals.changedDates, changed, glowTimer);
}

/**
 * Optimistically patches a single spot's occupant in polledData.
 * Returns a rollback function that restores the previous state.
 *
 * This mutates the signal by creating a new DayData with updated spots,
 * preserving Qwik's reactivity (signal.value = newObject).
 */
export function optimisticUpdateSpot(
  polledData: Signal<DayData | null>,
  colIndex: number,
  newOccupant: string,
): () => void {
  const prev = polledData.value;
  if (!prev) return () => {};

  const snapshot = prev;

  polledData.value = {
    ...prev,
    spots: prev.spots.map((s) =>
      s.colIndex === colIndex ? { ...s, occupant: newOccupant } : s,
    ),
  };

  return () => {
    polledData.value = snapshot;
  };
}
