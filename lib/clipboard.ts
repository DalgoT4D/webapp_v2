import { toastSuccess, toastError } from '@/lib/toast';

/**
 * Copy a URL to the clipboard and show a toast notification.
 *
 * Resolves to whether the copy succeeded. Failures are surfaced as a toast rather than
 * thrown, so without a return value a caller cannot tell them apart — and clipboard writes
 * do fail in practice (denied permission, non-secure context, lost document focus).
 * Analytics must not report a share the user never got.
 */
export async function copyUrlToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    toastSuccess.generic('URL copied to clipboard!');
    return true;
  } catch (error) {
    toastError.api(error, 'Failed to copy URL');
    return false;
  }
}
