/**
 * Tests for the /free-trial/activate set-password page.
 *
 * This screen does NOT create the account — it validates the password and hands token +
 * password to the consent screen via sessionStorage, which is where /trial/activate fires.
 * (The 400/409 activate-response tests that used to live here moved to the consent screen's
 * suite along with the call itself.)
 *
 * Covers: token read from the URL, the offline password rules, the /trial/validate-password
 * pre-flight (including its fail-open behaviour), the sessionStorage handoff, the
 * mismatched-confirm rule, and the missing-token error state.
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
const mockTrackFeatureView = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  trackFeatureView: (...args: unknown[]) => mockTrackFeatureView(...args),
}));

// The activate page moves on via a full-page navigation (lib/navigation.hardNavigate →
// window.location.assign), not router.push — see the page.
const mockAssign = jest.fn();
jest.mock('@/lib/navigation', () => ({
  hardNavigate: (...args: unknown[]) => mockAssign(...args),
}));
// Serve arbitrary search-param keys (not just `token`) and expose the router, so the
// shared trial shell components can reach for either without blowing up.
let mockSearchParams: Record<string, string | null> = { token: 'good-token' };
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/free-trial/activate',
  useSearchParams: () => ({ get: (key: string) => mockSearchParams[key] ?? null }),
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

const VALIDATE_PATH = '/api/v1/public/trial/validate-password';

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = { token: 'good-token' };
  sessionStorage.clear();
  localStorage.clear();
  // Default: the backend accepts the password. Individual tests override.
  mockApiPublicPost.mockResolvedValue({ valid: true });
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

function readPendingActivation() {
  return JSON.parse(sessionStorage.getItem('dalgo_trial_pending_activation') || '{}');
}

describe('TrialActivatePage', () => {
  it('renders the password + confirm password fields plus submit button when a token is present', () => {
    render(<TrialActivatePage />);

    expect(screen.getByTestId('trial-activate-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-activate-confirm-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-activate-submit-button')).toBeInTheDocument();
  });

  it('pre-flights the password against the backend, then hands token + password to the consent screen', async () => {
    render(<TrialActivatePage />);

    await fillAndSubmit('super-secret-1', 'super-secret-1');

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith(VALIDATE_PATH, {
        password: 'super-secret-1',
      });
    });

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('/free-trial/consent');
    });
    expect(readPendingActivation()).toEqual({
      token: 'good-token',
      password: 'super-secret-1',
    });
  });

  it("shows Django's own reason and does not advance when the backend rejects the password", async () => {
    // The rule the client can't check offline — CommonPasswordValidator's 20k-word list.
    mockApiPublicPost.mockRejectedValueOnce(
      new Error('Public API error: 400 Bad Request - This password is too common.')
    );
    render(<TrialActivatePage />);

    await fillAndSubmit('password123', 'password123');

    expect(await screen.findByText('This password is too common.')).toBeInTheDocument();
    expect(mockAssign).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('dalgo_trial_pending_activation')).toBeNull();
  });

  it('rejects a too-short password offline, without calling the backend', async () => {
    render(<TrialActivatePage />);

    await fillAndSubmit('Ab1!x', 'Ab1!x');

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockApiPublicPost).not.toHaveBeenCalled();
  });

  it('rejects an all-numeric password offline, without calling the backend', async () => {
    render(<TrialActivatePage />);

    await fillAndSubmit('4831067295', '4831067295');

    expect(await screen.findByText('Password cannot be entirely numbers')).toBeInTheDocument();
    expect(mockApiPublicPost).not.toHaveBeenCalled();
  });

  it('falls open and lets the user through when the pre-flight itself fails', async () => {
    // A 500 / network error means the CHECK broke, not the password. /trial/activate
    // re-validates server-side, so blocking signup here would be strictly worse.
    mockApiPublicPost.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<TrialActivatePage />);

    await fillAndSubmit('super-secret-1', 'super-secret-1');

    await waitFor(() => {
      expect(mockAssign).toHaveBeenCalledWith('/free-trial/consent');
    });
  });

  it('shows a validation error and makes no API call when passwords do not match', async () => {
    render(<TrialActivatePage />);

    await fillAndSubmit('super-secret-1', 'different-password');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('shows an invalid-link error state when the token is missing from the URL', () => {
    mockSearchParams = { token: null };
    render(<TrialActivatePage />);

    expect(screen.getByTestId('trial-activate-invalid-token')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-activate-password-input')).not.toBeInTheDocument();
  });
});
