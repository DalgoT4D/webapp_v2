/**
 * Tests for the /free-trial signup form page.
 *
 * Covers: field rendering, successful submit → "check your email" state,
 * and the 409 (account exists) branch.
 */

import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// The shared trial shell components render inside the App Router. Stub the router
// hooks so any component reaching for them doesn't blow up with
// "invariant expected app router to be mounted".
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/free-trial',
  useSearchParams: () => ({ get: () => null }),
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
  // `priority` and `fill` are consumed by the real next/image and never reach the DOM.
  // Strip them here too, otherwise React logs non-boolean attribute warnings that bury
  // any genuine warning this suite might surface.
  function MockImage({
    priority,
    fill,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; fill?: boolean }) {
    void priority;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not the real app
    return <img alt="" {...props} />;
  }
  return MockImage;
});

jest.mock('@/components/ui/animated-background-simple', () => ({
  AnimatedBackgroundSimple: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import FreeTrialPage from '@/app/free-trial/page';

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom gives each test FILE a fresh storage, not each test — clear explicitly so
  // nothing written by one test leaks into the next.
  localStorage.clear();
  sessionStorage.clear();
});

// Function is a Radix Select whose displayed option labels differ from the stored slug value
// (e.g. "Program Implementation" → "program_implementation"); pass the visible label to pick,
// assert the slug.
async function fillAndSubmit(
  email = 'jane@example.org',
  orgName = 'Acme Foundation',
  roleLabel = 'Program Implementation'
) {
  const user = userEvent.setup();
  fireEvent.change(screen.getByTestId('trial-signup-email-input'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByTestId('trial-signup-org-name-input'), {
    target: { value: orgName },
  });
  await user.click(screen.getByTestId('trial-signup-role-input'));
  await user.click(await screen.findByRole('option', { name: roleLabel }));
  fireEvent.click(screen.getByTestId('trial-signup-submit-button'));
}

describe('FreeTrialPage', () => {
  it('renders the email, org name, and role fields plus submit button', () => {
    render(<FreeTrialPage />);

    expect(screen.getByTestId('trial-signup-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-signup-org-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-signup-role-input')).toBeInTheDocument();
    expect(screen.getByTestId('trial-signup-submit-button')).toBeInTheDocument();
  });

  it('submits valid values via apiPublicPost with the trial signup payload', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ status: 'ok' });
    render(<FreeTrialPage />);

    await fillAndSubmit('jane@example.org', 'Acme Foundation', 'Program Implementation');

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith('/api/v1/public/trial/signup', {
        email: 'jane@example.org',
        org_name: 'Acme Foundation',
        role: 'program_implementation',
      });
    });
  });

  it('flips to the "check your email" state showing the entered email on success', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ status: 'ok' });
    render(<FreeTrialPage />);

    await fillAndSubmit('jane@example.org');

    const confirmation = await screen.findByTestId('trial-signup-confirmation');
    // Heading copy comes from Figma frame 2452:256 ("Verify your email").
    expect(confirmation).toHaveTextContent('Verify your email');
    expect(confirmation).toHaveTextContent('jane@example.org');
    expect(mockTrackEvent).toHaveBeenCalledWith('trial_onboarding:signup_submitted');
  });

  it('shows an info toast + login link on a 409 (account exists)', async () => {
    mockApiPublicPost.mockRejectedValueOnce(new Error('Public API error: 409 Conflict'));
    render(<FreeTrialPage />);

    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToastInfoGeneric).toHaveBeenCalledWith(
        'An account with this email already exists.'
      );
    });
    expect(screen.queryByTestId('trial-signup-confirmation')).not.toBeInTheDocument();
  });

  it('shows a generic error toast on a non-409 failure', async () => {
    mockApiPublicPost.mockRejectedValueOnce(
      new Error('Public API error: 500 Internal Server Error')
    );
    render(<FreeTrialPage />);

    await fillAndSubmit();

    await waitFor(() => {
      expect(mockToastErrorApi).toHaveBeenCalledWith(
        expect.any(Error),
        'Could not start your trial. Please try again.'
      );
    });
  });
});

describe('FreeTrialPage — check-your-email screen actions', () => {
  it('does not render a provider-specific check-email button', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ status: 'ok' });
    render(<FreeTrialPage />);
    await fillAndSubmit('jane@gmail.com');

    await screen.findByTestId('trial-signup-confirmation');
    expect(screen.queryByRole('link', { name: 'Check email' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('trial-open-email-app')).not.toBeInTheDocument();
  });

  it('re-sends the verification link with the same payload from the confirmation screen', async () => {
    mockApiPublicPost.mockResolvedValue({ status: 'ok' });
    render(<FreeTrialPage />);
    await fillAndSubmit('jane@example.org');
    await screen.findByTestId('trial-signup-confirmation');

    fireEvent.click(screen.getByTestId('trial-resend-link'));

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledTimes(2);
    });
    // same endpoint + same email as the original submit
    expect(mockApiPublicPost.mock.calls[1][0]).toBe('/api/v1/public/trial/signup');
    expect(mockApiPublicPost.mock.calls[1][1]).toMatchObject({ email: 'jane@example.org' });
    expect(mockToastInfoGeneric).toHaveBeenCalledWith(
      'Verification link re-sent to jane@example.org.'
    );
    // Resend calls an API, so analytics.md requires it be instrumented.
    expect(mockTrackEvent).toHaveBeenCalledWith('trial_onboarding:link_resent');
  });

  it('returns to the signup form via "Start over" so a wrong email can be corrected', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ status: 'ok' });
    render(<FreeTrialPage />);
    await fillAndSubmit('wrong@example.org');
    await screen.findByTestId('trial-signup-confirmation');

    fireEvent.click(screen.getByTestId('trial-change-email'));

    // back on the form
    expect(await screen.findByTestId('trial-signup-submit-button')).toBeInTheDocument();
    expect(screen.queryByTestId('trial-signup-confirmation')).not.toBeInTheDocument();
  });
});
