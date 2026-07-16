import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Reads the HTTP status off an error thrown by `lib/api.ts`'s `apiFetch`
 * (which stamps `.status` on the Error it throws for a non-2xx response).
 * Duck-typed on purpose — SWR's `error` is untyped, and tests mock rejected
 * values as plain `Object.assign(new Error(...), { status })` rather than a
 * real class instance, so `instanceof` would be brittle here.
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/**
 * Reads the parsed JSON response body off an error thrown by `apiFetch`
 * (which stamps `.body` alongside `.status` for a non-2xx response — see
 * lib/api.ts). Needed wherever a non-2xx response carries a typed payload
 * the caller must act on, not just a message string — e.g. `update_dashboard`'s
 * 409 `EmbedCoverageConfirmation` (v1.1 M3b), which names the under-covering
 * charts a save must re-prompt for. Duck-typed for the same reason as
 * `getApiErrorStatus` above.
 */
export function getApiErrorBody<T = unknown>(error: unknown): T | undefined {
  if (error && typeof error === 'object' && 'body' in error) {
    return (error as { body?: T }).body;
  }
  return undefined;
}
