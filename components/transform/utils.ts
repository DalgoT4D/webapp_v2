// components/transform/utils.ts

/**
 * Relative time display matching v1's moment().fromNow() behavior.
 * Returns a human-readable string like "a few seconds ago", "5 minutes ago", etc.
 */
export function timeAgo(dateString: string): string {
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'a few seconds ago';
  if (diffMin < 2) return 'a minute ago';
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHr < 2) return 'an hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffDays < 2) return 'a day ago';
  return `${diffDays} days ago`;
}

/**
 * Truncate a display name to a max length, appending "..." if truncated.
 */
export function truncateName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}
