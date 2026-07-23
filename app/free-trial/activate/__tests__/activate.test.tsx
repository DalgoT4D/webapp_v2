/**
 * Tests for the /free-trial/activate set-password page.
 *
 * Covers: token read from the URL, successful submit → apiPublicPost call,
 * stashing creds in sessionStorage, routing to the progress screen,
 * mismatched-confirm validation, and the missing-token error state.
 */

import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// jest.setup.ts globally mocks '@/lib/api' but only exports apiGet/apiPost/...
// (no apiPublicPost). Override it locally for this page, which uses the
// public (unauthenticated) API helper.
const mockApiPublicPost = jest.fn();
jest.mock('@/lib/api', () => ({
  apiPublicPost: (...args: unknown[]) => mockApiPublicPost(...args),
}));

const mockToastInfoGeneric = jest.fn();
const mockToastErrorApi = jest.fn();
jest.mock('@/lib/toast', () => ({
  toastInfo: { generic: (...args: unknown[]) => mockToastInfoGeneric(...args) },
  toastError: { api: (...args: unknown[]) => mockToastErrorApi(...args) },
}));

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

// The activate page redirects to the progress screen via a full-page navigation
// (lib/navigation.hardNavigate → window.location.assign), not router.push — see the page.
const mockAssign = jest.fn();
jest.mock('@/lib/navigation', () => ({
  hardNavigate: (...args: unknown[]) => mockAssign(...args),
}));
let mockToken: string | null = 'good-token';
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? mockToken : null) }),
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

import TrialActivatePage from '@/app/free-trial/activate/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'good-token';
  sessionStorage.clear();
});

async function fillAndSubmit(password = 'super-secret-1', confirmPassword = password) {
  fireEvent.change(screen.getByTestId('trial-activate-password-input'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByTestId('trial-activate-confirm-password-input'), {
    target: { value: confirmPassword },
  });
  fireEvent.click(screen.getByTestId('trial-activate-submit-button'));
}

describe('TrialActivatePage', () => {
  it('renders the password + confirm password fields plus submit button when a token is present', () => {
    render(<TrialActivatePage />);

    expect(screen.getByTestId('trial-activate-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-activate-confirm-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-activate-submit-button')).toBeInTheDocument();
  });

  it('submits token + password via apiPublicPost, stashes creds, and routes to the progress screen', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ task_id: 'task-123', email: 'jane@example.org' });
    render(<TrialActivatePage />);

    await fillAndSubmit('super-secret-1', 'super-secret-1');

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith('/api/v1/public/trial/activate', {
        token: 'good-token',
        password: 'super-secret-1',
      });
    });

    expect(JSON.parse(sessionStorage.getItem('dalgo_trial_creds') || '{}')).toEqual({
      email: 'jane@example.org',
      password: 'super-secret-1',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:trial_activated');
    expect(mockAssign).toHaveBeenCalledWith('/free-trial/progress?task_id=task-123');
  });

  it('shows a validation error and makes no API call when passwords do not match', async () => {
    render(<TrialActivatePage />);

    await fillAndSubmit('super-secret-1', 'different-password');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockApiPublicPost).not.toHaveBeenCalled();
  });

  it('shows an invalid-link error state when the token is missing from the URL', () => {
    mockToken = null;
    render(<TrialActivatePage />);

    expect(screen.getByTestId('trial-activate-invalid-token')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-activate-password-input')).not.toBeInTheDocument();
  });

  it('shows an error toast + request-new-link on a 400 (invalid/expired token)', async () => {
    mockApiPublicPost.mockRejectedValueOnce(new Error('Public API error: 400 Bad Request'));
    render(<TrialActivatePage />);

    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToastErrorApi).toHaveBeenCalledWith(
        expect.any(Error),
        'This link is invalid or has expired.'
      );
    });
    expect(screen.getByTestId('trial-activate-invalid-token')).toBeInTheDocument();
  });

  it('shows an info toast + login link on a 409 (account exists / already provisioning)', async () => {
    mockApiPublicPost.mockRejectedValueOnce(new Error('Public API error: 409 Conflict'));
    render(<TrialActivatePage />);

    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToastInfoGeneric).toHaveBeenCalledWith(
        'This account already exists or is already being set up.'
      );
    });
    expect(mockAssign).not.toHaveBeenCalled();
  });
});
