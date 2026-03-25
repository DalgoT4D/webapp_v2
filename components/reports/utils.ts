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

// Palette of avatar colors matching the Figma designs
const AVATAR_COLORS = [
  '#4285F4', // blue
  '#34A853', // green
  '#EA4335', // red
  '#FBBC04', // yellow
  '#E91E63', // pink
  '#9C27B0', // purple
  '#FF5722', // deep orange
  '#00BCD4', // cyan
  '#795548', // brown
  '#607D8B', // blue grey
] as const;

/**
 * Generate a consistent avatar color from a user's email.
 * Uses a simple hash so the same email always gets the same color.
 */
export function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Get initials from an author object (max 2 chars).
 */
export function getInitials(author: { email: string; name?: string }): string {
  if (author.name) {
    return author.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return author.email[0].toUpperCase();
}

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
