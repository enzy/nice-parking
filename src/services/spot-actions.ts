/**
 * Shared server-side helpers for spot reservation actions.
 *
 * These are plain async functions (not routeAction$ or server$) intended
 * to be called from within routeAction$ handlers so the duplication of
 * reserve / quick-reserve logic across route files is minimised.
 */

import type { EnvGetter } from "@builder.io/qwik-city/middleware/request-handler";
import type { DayData } from "./types";
import { updateSpot, ConflictError } from "./sheets";

export type ReserveResult = {
  success: boolean;
  error?: string;
  conflict?: boolean;
  spotName?: string;
  colIndex?: number;
};

/**
 * Reserve (or clear) a specific spot.
 */
export async function reserveSpot(
  accessToken: string,
  env: EnvGetter,
  rowIndex: number,
  colIndex: number,
  value: string,
  expectedValue: string,
): Promise<ReserveResult> {
  try {
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
}

/**
 * Quick-reserve the first free spot for `userName` in the given day data.
 */
export async function quickReserveSpot(
  accessToken: string,
  env: EnvGetter,
  userName: string,
  getDayData: () => Promise<DayData | null>,
): Promise<ReserveResult> {
  try {
    const dayData = await getDayData();
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
    return {
      success: true,
      spotName: freeSpot.name,
      colIndex: freeSpot.colIndex,
    };
  } catch (e) {
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
}
