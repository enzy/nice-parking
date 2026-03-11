import { google } from "googleapis";
import type { RequestEventBase } from "@builder.io/qwik-city";
import { getOAuth2Client } from "./auth";
import { formatDate } from "./date-utils";

/**
 * Get the sheet tab name for a given year.
 * The spreadsheet uses year numbers as tab names (e.g. "2024", "2026").
 */
function getSheetName(year?: number): string {
  return String(year ?? new Date().getFullYear());
}

export type { SpotData, DayData } from "./types";
import type { DayData, SpotData } from "./types";

function getSheetsClient(accessToken: string, env: RequestEventBase["env"]) {
  const auth = getOAuth2Client(env);
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

/**
 * Get all data from the spreadsheet.
 * Returns headers and all day rows.
 */
export async function getSheetData(
  accessToken: string,
  env: RequestEventBase["env"]
): Promise<{ headers: string[]; rows: string[][] }> {
  const sheets = getSheetsClient(accessToken, env);
  const sheetId = env.get("GOOGLE_SHEET_ID")!;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${getSheetName()}`,
  });

  const values = res.data.values || [];
  const headers = values[0] || [];
  const rows = values.slice(1);

  return { headers: headers as string[], rows: rows as string[][] };
}

/**
 * Parse a single row into DayData.
 */
export function parseRow(
  headers: string[],
  row: string[],
  rowIndex: number
): DayData {
  const date = row[0] || "";
  const day = row[1] || "";
  const spots: SpotData[] = [];

  // Columns C onwards (index 2+) are spot/divider columns
  for (let i = 2; i < headers.length; i++) {
    const occupant = row[i] || "";
    const isDivider = occupant === "X" || headers[i] === "X";
    spots.push({
      colIndex: i,
      name: headers[i] || `Spot ${i - 1}`,
      occupant: isDivider ? "X" : occupant,
      isDivider,
    });
  }

  return { date, day, rowIndex, spots };
}

/**
 * Find the row index for a given date string.
 */
export function findRowForDate(
  rows: string[][],
  dateStr: string
): number | null {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === dateStr) {
      return i + 2; // +1 for header, +1 for 1-based
    }
  }
  return null;
}

/**
 * Reserve or clear a spot by updating a single cell.
 */
export async function updateSpot(
  accessToken: string,
  env: RequestEventBase["env"],
  rowIndex: number,
  colIndex: number,
  value: string
): Promise<void> {
  const sheets = getSheetsClient(accessToken, env);
  const sheetId = env.get("GOOGLE_SHEET_ID")!;

  // Convert column index to letter (A=0, B=1, C=2, ...)
  const colLetter = columnToLetter(colIndex);
  const range = `${getSheetName()}!${colLetter}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [[value]],
    },
  });
}

/**
 * Convert 0-based column index to spreadsheet column letter(s).
 */
function columnToLetter(col: number): string {
  let letter = "";
  let temp = col;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Get data for a specific date.
 */
export async function getDayData(
  accessToken: string,
  env: RequestEventBase["env"],
  dateStr: string
): Promise<DayData | null> {
  const { headers, rows } = await getSheetData(accessToken, env);
  const rowIndex = findRowForDate(rows, dateStr);
  if (rowIndex === null) return null;
  return parseRow(headers, rows[rowIndex - 2], rowIndex);
}

/**
 * Get data for today.
 */
export async function getTodayData(
  accessToken: string,
  env: RequestEventBase["env"]
): Promise<DayData | null> {
  const today = formatDate(new Date());
  return getDayData(accessToken, env, today);
}

/**
 * Get data for the next N days (including today).
 */
export async function getUpcomingDays(
  accessToken: string,
  env: RequestEventBase["env"],
  count: number = 15
): Promise<DayData[]> {
  const { headers, rows } = await getSheetData(accessToken, env);
  const today = new Date();
  const result: DayData[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);
    const rowIndex = findRowForDate(rows, dateStr);
    if (rowIndex !== null) {
      result.push(parseRow(headers, rows[rowIndex - 2], rowIndex));
    }
  }

  return result;
}
