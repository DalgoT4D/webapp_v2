import useSWR from 'swr';
import { apiPublicGet } from '@/lib/api';
import { TRIAL_STATUS_PATH, TRIAL_STATUS_POLL_INTERVAL } from '@/constants/trial';
import type { TrialStatusResponse } from '@/types/trial';

interface UseTrialStatusOptions {
  // stop polling entirely (e.g. after we've given up on a wedged clone) by nulling the key
  enabled?: boolean;
  onSuccess?: () => void;
  onError?: () => void;
}

/**
 * Poll the public, unauthenticated trial-clone status endpoint every
 * TRIAL_STATUS_POLL_INTERVAL ms, stopping once the clone reaches a terminal
 * (`completed` / `failed`) state.
 *
 * Mirrors the app's canonical task-polling pattern (`useTaskStatus` in
 * useWarehouse.ts): explicit fetcher, `refreshInterval` callback that returns 0
 * on a terminal status, `revalidateOnFocus: false`. The only difference is the
 * fetcher — trial status is a `/api/v1/public/` route with no auth, so it uses
 * `apiPublicGet` rather than `apiGet`.
 */
export function useTrialStatus(taskId: string | null, options?: UseTrialStatusOptions) {
  const enabled = options?.enabled ?? true;
  const url = taskId && enabled ? `${TRIAL_STATUS_PATH}/${taskId}` : null;

  // Only include onSuccess/onError when the caller actually supplied them.
  // Passing `onError: undefined` explicitly OVERRIDES the SWRConfig provider's
  // onError with undefined; SWR then does `currentConfig.onError(...)` after every
  // request and throws "onError is not a function", which kills the polling loop.
  return useSWR<TrialStatusResponse>(url, apiPublicGet, {
    refreshInterval: (data?: TrialStatusResponse) =>
      data?.status === 'completed' || data?.status === 'failed' ? 0 : TRIAL_STATUS_POLL_INTERVAL,
    revalidateOnFocus: false,
    // Keep polling even when the tab is backgrounded/hidden. Without this SWR pauses the
    // refreshInterval whenever document.visibilityState !== 'visible' (its default
    // refreshWhenHidden: false), so a progress screen opened in a not-yet-focused tab —
    // or one the user tabs away from — silently stops advancing and only updates on refresh.
    refreshWhenHidden: true,
    ...(options?.onSuccess ? { onSuccess: options.onSuccess } : {}),
    ...(options?.onError ? { onError: options.onError } : {}),
  });
}
