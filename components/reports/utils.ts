import { formatDistanceToNow, format, isThisYear } from 'date-fns';

// Shared constants for report sharing dialogs
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_RECIPIENTS = 20;

/**
 * Format a date string as "Mar 31st, 2026" for display in report headers.
 */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return format(d, 'MMM do, yyyy');
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

/**
 * Format a comment timestamp in short relative form.
 * - < 1 min: "just now"
 * - < 60 min: "10 mins. ago"
 * - < 24 hours: "3 hrs. ago"
 * - >= 24 hours: "2 days ago", "1 week ago", etc.
 */
export function formatCommentTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  const ONE_MINUTE = 1;
  const ONE_HOUR = 60;
  const ONE_DAY = 24;
  const ONE_WEEK = 7;
  const ONE_MONTH = 30;

  if (diffMin < ONE_MINUTE) return 'just now';
  if (diffMin < ONE_HOUR) return `${diffMin} min${diffMin > 1 ? 's' : ''}. ago`;
  if (diffHrs < ONE_DAY) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''}. ago`;
  if (diffDays < ONE_WEEK) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffDays < ONE_MONTH) {
    const weeks = Math.floor(diffDays / ONE_WEEK);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

// Avatar color/initials helpers live in lib/avatar.ts (shared with UserAvatar).
// Re-exported here so existing report/comment imports keep working.
export { getAvatarColor, getInitials } from '@/lib/avatar';

// Match @email patterns (email-like strings after @)
const MENTION_REGEX = /@([\w.+-]+@[\w.-]+\.\w+)/g;

/**
 * Render comment content by converting @email mentions to styled spans.
 * Returns an array of React-renderable elements.
 */
export function parseCommentMentions(
  content: string
): Array<{ type: 'text' | 'mention'; value: string }> {
  const parts: Array<{ type: 'text' | 'mention'; value: string }> = [];
  const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'mention', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return parts;
}

/**
 * Extract unique mentioned email addresses from comment content.
 * Used to build the mentioned_emails array sent to the backend.
 */
export function extractMentionedEmails(content: string): string[] {
  const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
  const emails = new Set<string>();
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    emails.add(match[1]);
  }

  return Array.from(emails);
}
