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
 * Get the first character of an email as an uppercase initial.
 * Returns '?' as fallback for empty or missing values.
 */
export function getInitials(email: string): string {
  return email?.[0]?.toUpperCase() ?? '?';
}
