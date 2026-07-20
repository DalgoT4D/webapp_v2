/**
 * Tests for the /free-trial/progress live-progress + auto-login page.
 *
 * Covers: rendering CloneProgress with the current index derived from a
 * running status, the completed-status auto-login flow (apiPost login call,
 * sessionStorage cleared, setAuthenticated(true), redirect to /impact), and
 * the failed-status retry state.
 */

import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import type { TrialStatusResponse } from '@/types/trial';

// jest.setup.ts globally mocks '@/lib/api' but only exports apiGet/apiPost/...
// Override locally so we control apiPost's resolution for the auto-login call.
const mockApiPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
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
jest.mock('swr', () => ({
  __esModule: true,
  default: () => ({ data: mockSwrData }),
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

  it('auto-logs in on a completed status using stashed creds and redirects to /impact', async () => {
    sessionStorage.setItem(
      CREDS_STORAGE_KEY,
      JSON.stringify({ email: 'jane@example.org', password: 'super-secret-1' })
    );
    mockApiPost.mockResolvedValueOnce({});
    mockSwrData = {
      task_id: 'task-123',
      status: 'completed',
      progress: [{ step: 8, message: 'Preparing your dashboards', status: 'done' }],
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
      progress: [{ step: 8, message: 'Preparing your dashboards', status: 'done' }],
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
      progress: [{ step: 8, message: 'Preparing your dashboards', status: 'done' }],
      org_slug: 'acme',
    };

    render(<TrialProgressPage />);

    await waitFor(() => {
      expect(screen.getByTestId('trial-login-cta')).toBeInTheDocument();
    });

    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the "Something went wrong" message and a retry button on a failed status', () => {
    mockSwrData = {
      task_id: 'task-123',
      status: 'failed',
      progress: [{ step: 3, message: 'Copying your data', status: 'failed' }],
    };

    render(<TrialProgressPage />);

    expect(screen.getByTestId('trial-progress-failed')).toHaveTextContent(
      'Something went wrong setting up your workspace'
    );
    expect(screen.getByTestId('trial-progress-retry-button')).toHaveAttribute(
      'href',
      '/free-trial'
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:clone_failed');
  });
});
