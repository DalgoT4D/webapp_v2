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
jest.mock('@/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

import FreeTrialPage from '@/app/free-trial/page';

beforeEach(() => {
  jest.clearAllMocks();
});

// Role is a Radix Select whose displayed option labels differ from the stored slug value
// (e.g. "Program Manager" → "program_manager"); pass the visible label to pick, assert the slug.
async function fillAndSubmit(
  email = 'jane@example.org',
  orgName = 'Acme Foundation',
  roleLabel = 'Program Manager'
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

    await fillAndSubmit('jane@example.org', 'Acme Foundation', 'Program Manager');

    await waitFor(() => {
      expect(mockApiPublicPost).toHaveBeenCalledWith('/api/v1/public/trial/signup', {
        email: 'jane@example.org',
        org_name: 'Acme Foundation',
        role: 'program_manager',
      });
    });
  });

  it('flips to the "check your email" state showing the entered email on success', async () => {
    mockApiPublicPost.mockResolvedValueOnce({ status: 'ok' });
    render(<FreeTrialPage />);

    await fillAndSubmit('jane@example.org');

    const confirmation = await screen.findByTestId('trial-signup-confirmation');
    expect(confirmation).toHaveTextContent('Check your email');
    expect(confirmation).toHaveTextContent('jane@example.org');
    expect(mockTrackEvent).toHaveBeenCalledWith('trial:signup_submitted');
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
