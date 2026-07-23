/**
 * Tests for useTrialStatus — the free-trial clone status poller.
 *
 * Uses the REAL `swr` (not a mock) with an isolated cache so we can assert the
 * hook actually invokes the public fetcher with the right key, and correctly
 * suppresses fetching when disabled / when there is no task id. This is the
 * regression guard for the "screen spins but never polls" bug: the hook must
 * pass an explicit fetcher and a non-null key.
 */

import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';

const mockApiPublicGet = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPublicGet: (...args: unknown[]) => mockApiPublicGet(...args),
}));

import { useTrialStatus } from '../useTrialStatus';

// Fresh SWR cache + no dedupe/focus revalidation so each test starts clean.
function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
      {children}
    </SWRConfig>
  );
}

// Mirrors the REAL app provider (lib/swr.tsx) so recurrence tests exercise the same
// dedupingInterval the production progress screen runs under.
function realProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        loadingTimeout: 10000,
        onError: () => {},
      }}
    >
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiPublicGet.mockResolvedValue({ task_id: 't1', progress: [], status: 'pending' });
});

describe('useTrialStatus', () => {
  it('fetches the status endpoint on mount via apiPublicGet', async () => {
    renderHook(() => useTrialStatus('t1'), { wrapper });

    await waitFor(() =>
      expect(mockApiPublicGet).toHaveBeenCalledWith('/api/v1/public/trial/status/t1')
    );
  });

  it('exposes the fetched status as data', async () => {
    mockApiPublicGet.mockResolvedValue({ task_id: 't1', progress: [], status: 'running' });
    const { result } = renderHook(() => useTrialStatus('t1'), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe('running'));
  });

  it('polls repeatedly on a non-terminal status under the real provider config', async () => {
    mockApiPublicGet.mockResolvedValue({ task_id: 't1', progress: [], status: 'pending' });
    renderHook(() => useTrialStatus('t1'), { wrapper: realProviderWrapper });

    await waitFor(() => expect(mockApiPublicGet).toHaveBeenCalledTimes(1));
    // recurring poll must fire again — this is the regression that made the screen
    // update only on manual refresh
    await waitFor(() => expect(mockApiPublicGet.mock.calls.length).toBeGreaterThanOrEqual(2), {
      timeout: 8000,
      interval: 200,
    });
  }, 10000);

  it('does not fetch when disabled (polling given up)', async () => {
    renderHook(() => useTrialStatus('t1', { enabled: false }), { wrapper });

    // give SWR a tick to (not) fire
    await new Promise((r) => setTimeout(r, 0));
    expect(mockApiPublicGet).not.toHaveBeenCalled();
  });

  it('does not fetch when there is no task id', async () => {
    renderHook(() => useTrialStatus(null), { wrapper });

    await new Promise((r) => setTimeout(r, 0));
    expect(mockApiPublicGet).not.toHaveBeenCalled();
  });
});
