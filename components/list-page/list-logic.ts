import { format } from 'date-fns';

/**
 * Pure rules shared by the charts, dashboards and reports list pages.
 * Each page keeps its own pagination model; these functions only do the math.
 */

export type SortOrder = 'asc' | 'desc';
export type SortValue = string | number;

/** Page size every list starts with. */
export const DEFAULT_LIST_PAGE_SIZE = 10;
/** Choices in the "Show" page-size select (same on all three lists). */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Sort by one value. Array.prototype.sort is stable, so equal values keep the order the
 * server returned them in. PINNED-BUGS: "Sort ties fall back to server order".
 */
export function sortRows<T>(rows: T[], getValue: (row: T) => SortValue, order: SortOrder): T[] {
  return [...rows].sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);
    if (order === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
    return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
  });
}

/** The rows of one 1-based page. */
export function paginateRows<T>(rows: T[], currentPage: number, pageSize: number): T[] {
  const startIndex = (currentPage - 1) * pageSize;
  return rows.slice(startIndex, startIndex + pageSize);
}

/** "N filter(s) active": one flag per filter column. */
export function countActiveFilters(activeFlags: boolean[]): number {
  return activeFlags.filter(Boolean).length;
}

/**
 * Footer text "11–20 of 45". A page past the end prints an inverted range —
 * PINNED-BUGS: "Deleting only row on last page → "2 of 1", "11–10 of 10", no-match row".
 */
export function formatItemRange(currentPage: number, pageSize: number, total: number): string {
  if (total === 0) return '0–0 of 0';
  const startIndex = (currentPage - 1) * pageSize;
  return `${startIndex + 1}–${Math.min(startIndex + pageSize, total)} of ${total}`;
}

/** Multi-select checkbox lists: tick adds at the end, untick removes. */
export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** Search box inside a multi-select filter: case-insensitive substring. */
export function filterOptionsBySearch(options: string[], search: string): string[] {
  return options.filter((option) => option.toLowerCase().includes(search.toLowerCase()));
}

export type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

export interface DateFilter {
  range: DateRange;
  customStart: Date | null;
  customEnd: Date | null;
}

export function createEmptyDateFilter(): DateFilter {
  return { range: 'all', customStart: null, customEnd: null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** "Last 7 days" looks back exactly 7×24h from now. */
const WEEK_DAYS = 7;
/** "Last 30 days" looks back exactly 30×24h from now. */
const MONTH_DAYS = 30;

/**
 * "Date modified" column filter. A row without a timestamp always matches.
 * Each check is written as "reject when before/after" (not ">="), so an unparseable
 * timestamp (NaN compares false) matches — as today.
 */
export function matchesDateFilter(
  updatedAt: string | null | undefined,
  filter: DateFilter,
  now: Date = new Date()
): boolean {
  if (filter.range === 'all' || !updatedAt) return true;
  const updatedDate = new Date(updatedAt);

  switch (filter.range) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return !(updatedDate < today);
    }
    case 'week':
      return !(updatedDate < new Date(now.getTime() - WEEK_DAYS * DAY_MS));
    case 'month':
      return !(updatedDate < new Date(now.getTime() - MONTH_DAYS * DAY_MS));
    case 'custom':
      if (filter.customStart && updatedDate < filter.customStart) return false;
      if (filter.customEnd && updatedDate > filter.customEnd) return false;
      return true;
  }
}

/**
 * How the custom-range <input type="date"> values are read and shown.
 * LIST-DRIFT: charts use 'iso-date' (UTC midnight), dashboards use 'local-date' (local midnight).
 */
export type DateInputMode = 'iso-date' | 'local-date';

export function formatDateInputValue(date: Date | null, mode: DateInputMode): string {
  if (!date) return '';
  return mode === 'iso-date' ? date.toISOString().split('T')[0] : format(date, 'yyyy-MM-dd');
}

export function parseDateInputValue(value: string, mode: DateInputMode): Date | null {
  if (!value) return null;
  return mode === 'iso-date' ? new Date(value) : new Date(value + 'T00:00:00');
}
