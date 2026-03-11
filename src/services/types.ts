export interface SpotData {
  /** Column index (0-based) */
  colIndex: number;
  /** Spot name from header row */
  name: string;
  /** Person who reserved (empty = free, "X" = divider) */
  occupant: string;
  /** Whether this is a divider column */
  isDivider: boolean;
}

export interface DayData {
  /** Date string from column A */
  date: string;
  /** Day name from column B */
  day: string;
  /** Row index in the spreadsheet (1-based) */
  rowIndex: number;
  /** All spots for this day */
  spots: SpotData[];
}
