import { toastSuccess, toastError } from '@/lib/toast';

/**
 * Copy a URL to the clipboard and show a toast notification.
 */
export async function copyUrlToClipboard(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toastSuccess.generic('URL copied to clipboard!');
  } catch (error) {
    toastError.api(error, 'Failed to copy URL');
  }
}
