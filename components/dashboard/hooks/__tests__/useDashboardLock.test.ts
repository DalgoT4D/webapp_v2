import { act, renderHook } from '@testing-library/react';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import {
  LOCK_REFRESH_INTERVAL_MS,
  useDashboardLock,
  useLockReleaseOnLeave,
} from '@/components/dashboard/hooks/useDashboardLock';

const mockApiPost = apiPost as jest.Mock;
const mockApiPut = apiPut as jest.Mock;
const mockApiDelete = apiDelete as jest.Mock;
const LOCK_URL = '/api/dashboards/7/lock/';

/** Lets the awaited lock request and the state updates after it settle. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApiPost.mockResolvedValue({ lock_token: 'tok-1' });
  mockApiPut.mockResolvedValue({});
  mockApiDelete.mockResolvedValue({});
  setDocumentHidden(false);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useDashboardLock', () => {
  it('takes the lock on mount and refreshes it every 60 seconds', async () => {
    const { result } = renderHook(() => useDashboardLock(7));
    await settle();
    expect(mockApiPost).toHaveBeenCalledWith(LOCK_URL, {});
    expect(result.current.lockToken).toBe('tok-1');

    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS));
    expect(mockApiPut).toHaveBeenCalledWith('/api/dashboards/7/lock/refresh/', {});
    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS));
    expect(mockApiPut).toHaveBeenCalledTimes(2);
  });

  it('a failed refresh stops refreshing and drops the token', async () => {
    const { result } = renderHook(() => useDashboardLock(7));
    await settle();
    mockApiPut.mockRejectedValueOnce(new Error('expired'));
    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS));
    await settle();
    expect(result.current.lockToken).toBeNull();
    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS * 2));
    expect(mockApiPut).toHaveBeenCalledTimes(1);
  });

  it('a 423 answer alerts with the backend message', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockApiPost.mockRejectedValueOnce({ status: 423, message: 'locked by ana@ngo.org' });
    renderHook(() => useDashboardLock(7));
    await settle();
    expect(alertSpy).toHaveBeenCalledWith(
      'This dashboard is currently being edited by another user: locked by ana@ngo.org'
    );
  });

  it('beforeunload sends a beacon to the relative URL (pinned)', async () => {
    // PINNED-BUGS: "Browser unload unlock beacon posts to relative URL on Next server → locks leak until expiry"
    const sendBeacon = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
    renderHook(() => useDashboardLock(7));
    await settle();
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    expect(sendBeacon).toHaveBeenCalledWith(LOCK_URL, JSON.stringify({ method: 'DELETE' }));
  });

  it('hiding the tab sends a keepalive DELETE to the Next server and never re-acquires (pinned)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({});
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem('token', 't-1');
    localStorage.setItem('selectedOrg', 'org-a');
    renderHook(() => useDashboardLock(7));
    await settle();

    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledWith(LOCK_URL, {
      method: 'DELETE',
      keepalive: true,
      headers: { Authorization: 'Bearer t-1', 'x-dalgo-org': 'org-a' },
    });

    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('unmount sends no DELETE (first-render closures) but stops the refresh', async () => {
    const { unmount } = renderHook(() => useDashboardLock(7));
    await settle();
    unmount();
    await settle();
    expect(mockApiDelete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS));
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('unlockDashboard releases a held lock and stops the refresh', async () => {
    const { result } = renderHook(() => useDashboardLock(7));
    await settle();
    await act(async () => {
      await result.current.unlockDashboard();
    });
    expect(mockApiDelete).toHaveBeenCalledWith(LOCK_URL);
    expect(result.current.lockToken).toBeNull();
    act(() => jest.advanceTimersByTime(LOCK_REFRESH_INTERVAL_MS));
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it('no dashboard id: no lock request', async () => {
    renderHook(() => useDashboardLock(undefined));
    await settle();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});

describe('useLockReleaseOnLeave', () => {
  const makeRef = () => ({ current: { cleanup: jest.fn().mockResolvedValue(true) } });

  it('without edit access: no listeners, no release on unmount', async () => {
    const ref = makeRef();
    const { unmount } = renderHook(() => useLockReleaseOnLeave(7, false, ref));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    unmount();
    await settle();
    expect(mockApiDelete).not.toHaveBeenCalled();
    expect(ref.current.cleanup).not.toHaveBeenCalled();
  });

  it('popstate releases the lock and runs the builder cleanup', async () => {
    const ref = makeRef();
    renderHook(() => useLockReleaseOnLeave(7, true, ref));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await settle();
    expect(mockApiDelete).toHaveBeenCalledWith(LOCK_URL);
    expect(ref.current.cleanup).toHaveBeenCalledTimes(1);
  });

  it('a link to another path releases; a link to the same path does not', async () => {
    const ref = makeRef();
    renderHook(() => useLockReleaseOnLeave(7, true, ref));
    const same = document.createElement('a');
    same.href = window.location.pathname;
    same.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(same);
    act(() => same.click());
    expect(mockApiDelete).not.toHaveBeenCalled();

    const other = document.createElement('a');
    other.href = '/dashboards';
    other.addEventListener('click', (e) => e.preventDefault());
    document.body.appendChild(other);
    act(() => other.click());
    await settle();
    expect(mockApiDelete).toHaveBeenCalledWith(LOCK_URL);
    same.remove();
    other.remove();
  });

  it('hiding the tab releases (pinned) and page unmount releases', async () => {
    const ref = makeRef();
    const { unmount } = renderHook(() => useLockReleaseOnLeave(7, true, ref));
    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(mockApiDelete).toHaveBeenCalledTimes(1);
    unmount();
    await settle();
    expect(mockApiDelete).toHaveBeenCalledTimes(2);
  });
});
