/**
 * Shared helpers for the admin portal. Companion to constants.ts (which holds
 * EMAIL_RE) — same reason both exist: the portal's forms set `noValidate`, so the
 * browser's native checks never run and these are the only validation there is.
 */

/**
 * Is this a usable visualization URL?
 *
 * Both org forms render the field as `type="url"`, which never actually gets checked:
 * the create form sets `noValidate`, and the edit form has no `<form>` around it at
 * all. Without this any string reached the API. The field itself stays optional —
 * callers only validate what the admin actually typed.
 */
export function isValidVizUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Shown against the visualization URL field on both org forms. */
export const VIZ_URL_ERROR = 'Enter a full URL, e.g. https://superset.example.org';
