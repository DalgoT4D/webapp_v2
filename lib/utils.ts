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
 * Reads the HTTP status off an error thrown by apiFetch. Duck-typed on
 * purpose — SWR's `error` is untyped and tests mock plain Errors, so
 * `instanceof` would be brittle.
 */
export function getApiErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/**
 * Reads the parsed JSON body off an error thrown by apiFetch — for non-2xx
 * responses that carry a typed payload (e.g. a 409's confirmation body).
 * Duck-typed for the same reason as getApiErrorStatus.
 */
export function getApiErrorBody<T = unknown>(error: unknown): T | undefined {
  if (error && typeof error === 'object' && 'body' in error) {
    return (error as { body?: T }).body;
  }
  return undefined;
}
