/**
 * Parse string value for null/undefined handling.
 * Returns null for empty strings, 'null', and 'NULL'.
 */
export function parseStringForNull(value: string): string | null {
  if (value === '' || value === 'null' || value === 'NULL') return null;
  return value;
}
