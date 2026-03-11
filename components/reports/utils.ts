import { formatDistanceToNow, format, isThisYear } from 'date-fns';

/**
 * Format a date string as MM/DD/YYYY for compact display in report headers.
 */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a created-at timestamp for the reports list table.
 * - Within 7 days: relative time ("3 hours ago")
 * - This year: "12 Feb"
 * - Older: "20 Dec 2025"
 */
export function formatCreatedOn(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Within last 7 days: relative time
  const RECENT_DAYS_THRESHOLD = 7;
  if (diffDays < RECENT_DAYS_THRESHOLD) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // This year: "12 Feb"
  if (isThisYear(date)) {
    return format(date, 'd MMM');
  }

  // Older: "20 Dec 2025"
  return format(date, 'd MMM yyyy');
}
