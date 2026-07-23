/**
 * Tests for the /free-trial/progress live-progress + auto-login page.
 *
 * Covers: rendering CloneProgress with the current index derived from a
 * running status, the completed-status auto-login flow (apiPost login call,
 * sessionStorage cleared, setAuthenticated(true), redirect to /impact), and
 * the failed-status retry state.
 */

import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TrialStatusResponse } from '@/types/trial';

// jest.setup.ts globally mocks '@/lib/api' but only exports apiGet/apiPost/...
// Override locally so we control apiPost's resolution for the auto-login call and
// apiPublicPost's resolution for the "Try again" retry call.
const mockApiPost = jest.fn();
const mockApiPublicPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPublicPost: (...args: unknown[]) => mockApiPublicPost(...args),
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockSetAuthenticated = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: { getState: () => ({ setAuthenticated: mockSetAuthenticated }) },
}));

const mockReplace = jest.fn();
let mockTaskId: string | null = 'task-123';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: (key: string) => (key === 'task_id' ? mockTaskId : null) }),
}));

// Mock the 'swr' package directly (per plan) — the page polls with
// `useSWR` from 'swr', not the '@/lib/swr' provider wrapper.
let mockSwrData: TrialStatusResponse | undefined;
const mockMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: mockSwrData, mutate: mockMutate }),
}));

jest.mock('next/link', () => {
  function MockLink({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return MockLink;
});

jest.mock('next/image', () => {
  function MockImage(props: ImgHTMLAttributes<HTMLImageElement>) {
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not the real app
    return <img alt="" {...props} />;
  }
  return MockImage;
});

jest.mock('@/components/ui/animated-background-simple', () => ({
  AnimatedBackgroundSimple: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import TrialProgressPage from '@/app/free-trial/progress/page';

const CREDS_STORAGE_KEY = 'dalgo_trial_creds';

beforeEach(() => {
  jest.clearAllMocks();
  mockTaskId = 'task-123';
  mockSwrData = undefined;
  sessionStorage.clear();
});

describe('TrialProgressPage', () => {
  it('renders CloneProgress with the current index derived from a running status', () => {
    mockSwrData = {
      task_id: 'task-123',
      status: 'running',
      progress: [
        { step: 1, message: 'Creating your workspace', status: 'done' },
        { step: 2, message: 'Setting up your warehouse', status: 'in_progress' },
      ],
    };

    render(<TrialProgressPage />);

    expect(screen.getByTestId('trial-step-0')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('trial-step-1')).toHaveAttribute('data-state', 'in-progress');
    expect(screen.getByTestId('trial-step-2')).toHaveAttribute('data-state', 'pending');
  });

  it('shows the FIRST step (not all-done) when the history has only a "queued" marker', () => {
    // A freshly enqueued or just-retried clone has progress=[{queued}] — no numeric step and
    // no label match. The old fallback clamped to the LAST index, rendering every step as
    // completed plus a spinning "Finalizing" on a clone that had not even started.
    mockSwrData = {
      task_id: 'task-123',
      status: 'queued',
      progress: [{ message: 'queued', status: 'queued' }],
    };

    render(<TrialProgressPage />);

    expect(screen.getByTestId('trial-step-0')).toHaveAttribute('data-state', 'in-progress');
    expect(screen.getByTestId('trial-step-1')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('trial-step-6')).toHaveAttribute('data-state', 'pending');
  });

  it('auto-logs in on a completed status using stashed creds and redirects to /impact', async () => {
    sessionStorage.setItem(
      CREDS_STORAGE_KEY,
      JSON.stringify({ email: 'jane@example.org', password: 'super-secret-1' })
    );
    mockApiPost.mockResolvedValueOnce({});
    mockSwrData = {
      task_id: 'task-123',
      status: 'completed',
      progress: [{ step: 7, message: 'Preparing your dashboards', status: 'done' }],
      org_slug: 'acme',
    };

    render(<TrialProgressPage />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/v2/login/', {
        username: 'jane@example.org',
        password: 'super-secret-1',
      });
    });

    expect(sessionStorage.getItem(CREDS_STORAGE_KEY)).toBeNull();
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:clone_completed');
    expect(mockReplace).toHaveBeenCalledWith('/impact');
  });

  it('shows the manual-login state and clears creds when the auto-login POST rejects', async () => {
    sessionStorage.setItem(
      CREDS_STORAGE_KEY,
      JSON.stringify({ email: 'jane@example.org', password: 'super-secret-1' })
    );
    mockApiPost.mockRejectedValueOnce(new Error('network blip'));
    mockSwrData = {
      task_id: 'task-123',
      status: 'completed',
      progress: [{ step: 7, message: 'Preparing your dashboards', status: 'done' }],
      org_slug: 'acme',
    };

    render(<TrialProgressPage />);

    await waitFor(() => {
      expect(screen.getByTestId('trial-login-cta')).toBeInTheDocument();
    });

    expect(sessionStorage.getItem(CREDS_STORAGE_KEY)).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByTestId('trial-login-cta')).toHaveAttribute('href', '/login');
  });

  it('shows the manual-login state when the stashed creds are missing', async () => {
    // sessionStorage is cleared in beforeEach — nothing stashed.
    mockSwrData = {
      task_id: 'task-123',
      status: 'completed',
      progress: [{ step: 7, message: 'Preparing your dashboards', status: 'done' }],
      org_slug: 'acme',
    };

    render(<TrialProgressPage />);

    await waitFor(() => {
      expect(screen.getByTestId('trial-login-cta')).toBeInTheDocument();
    });

    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('flips to the timeout fallback (log-in + start-again) after the hard timeout with no terminal status', () => {
    jest.useFakeTimers();
    mockSwrData = {
      task_id: 'task-123',
      status: 'running',
      progress: [{ step: 1, message: 'Creating your workspace', status: 'in_progress' }],
    };

    render(<TrialProgressPage />);

    // spinner while still under the ceiling
    expect(screen.getByTestId('trial-progress-heading')).toBeInTheDocument();

    // advance past the 420s hard timeout (sits above the backend's ~360s teardown deadline)
    act(() => {
      jest.advanceTimersByTime(420 * 1000);
    });

    expect(screen.getByTestId('trial-progress-timeout')).toBeInTheDocument();
    expect(screen.getByTestId('trial-timeout-login-button')).toHaveAttribute('href', '/login');
    // "Start again" is now a retry button (POSTs /retry), not a link to /free-trial
    expect(screen.getByTestId('trial-timeout-retry-button').tagName).toBe('BUTTON');
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:poll_timeout');

    jest.useRealTimers();
  });

  it('shows the "Something went wrong" message and a retry button on a failed status', () => {
    mockSwrData = {
      task_id: 'task-123',
      status: 'failed',
      progress: [{ step: 3, message: 'Connecting your sources', status: 'failed' }],
    };

    render(<TrialProgressPage />);

    expect(screen.getByTestId('trial-progress-failed')).toHaveTextContent(
      'Something went wrong setting up your workspace'
    );
    // the retry button is now a real button, not a link — it re-runs the clone in place
    expect(screen.getByTestId('trial-progress-retry-button').tagName).toBe('BUTTON');
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:clone_failed');
  });

  it('re-enqueues the clone under the same task_id when "Try again" is clicked', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ task_id: 'task-123', email: 'jane@example.org' });
    mockSwrData = {
      task_id: 'task-123',
      status: 'failed',
      progress: [{ step: 3, message: 'Connecting your sources', status: 'failed' }],
    };

    render(<TrialProgressPage />);

    fireEvent.click(screen.getByTestId('trial-progress-retry-button'));

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith('/api/v1/public/trial/retry/task-123', {});
    });
    // revalidate so polling resumes from the fresh status (SWR halted its interval on "failed")
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
    // stays on the progress screen — no full-restart navigation
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to a full restart when the retry request fails', async () => {
    mockApiPublicPost.mockRejectedValueOnce(new Error('Public API error: 409'));
    mockSwrData = {
      task_id: 'task-123',
      status: 'failed',
      progress: [{ step: 3, message: 'Connecting your sources', status: 'failed' }],
    };

    render(<TrialProgressPage />);

    fireEvent.click(screen.getByTestId('trial-progress-retry-button'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/free-trial');
    });
  });
});
